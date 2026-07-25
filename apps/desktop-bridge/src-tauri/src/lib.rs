use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    io::Read,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
use walkdir::WalkDir;

const MAX_ROOTS: usize = 32;
const DEFAULT_MAX_READ_BYTES: u64 = 512_000;
const HARD_MAX_READ_BYTES: u64 = 2_000_000;
const HARD_MAX_SEARCH_RESULTS: usize = 500;
const MAX_SEARCHED_ENTRIES: usize = 50_000;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AllowedRoot {
    id: Uuid,
    path: PathBuf,
    label: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct FileEntry {
    name: String,
    relative_path: String,
    kind: &'static str,
    size: Option<u64>,
}

#[derive(Debug, Serialize)]
struct BridgeStatus {
    version: &'static str,
    read_only: bool,
    network_enabled: bool,
    allowed_root_count: usize,
}

#[derive(Debug, Serialize)]
struct AuditEvent {
    timestamp: DateTime<Utc>,
    action: String,
    root_id: Option<Uuid>,
    relative_path: Option<String>,
    outcome: String,
    detail: Option<String>,
}

#[derive(Default)]
struct BridgeState {
    roots: Mutex<Vec<AllowedRoot>>,
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn roots_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("allowed-roots.json"))
}

fn audit_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("audit.jsonl"))
}

fn load_roots(app: &AppHandle) -> Result<Vec<AllowedRoot>, String> {
    let path = roots_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn persist_roots(app: &AppHandle, roots: &[AllowedRoot]) -> Result<(), String> {
    let content = serde_json::to_string_pretty(roots).map_err(|error| error.to_string())?;
    fs::write(roots_path(app)?, content).map_err(|error| error.to_string())
}

fn audit(
    app: &AppHandle,
    action: &str,
    root_id: Option<Uuid>,
    relative_path: Option<&str>,
    outcome: &str,
    detail: Option<String>,
) {
    let event = AuditEvent {
        timestamp: Utc::now(),
        action: action.to_owned(),
        root_id,
        relative_path: relative_path.map(str::to_owned),
        outcome: outcome.to_owned(),
        detail,
    };
    let Ok(line) = serde_json::to_string(&event) else {
        return;
    };
    let Ok(path) = audit_path(app) else {
        return;
    };
    use std::io::Write;
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{line}");
    }
}

fn validate_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err("Absolute paths are not accepted".into());
    }
    for component in path.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Path traversal is not allowed".into())
            }
        }
    }
    Ok(path.to_path_buf())
}

fn find_root(state: &State<'_, BridgeState>, root_id: Uuid) -> Result<AllowedRoot, String> {
    let roots = state.roots.lock().map_err(|_| "Root store lock failed")?;
    roots
        .iter()
        .find(|root| root.id == root_id)
        .cloned()
        .ok_or_else(|| "Allowed root was not found".into())
}

fn resolve_target(root: &AllowedRoot, relative_path: &str) -> Result<PathBuf, String> {
    let safe_relative = validate_relative_path(relative_path)?;
    let canonical_root = fs::canonicalize(&root.path).map_err(|error| error.to_string())?;
    let candidate = canonical_root.join(safe_relative);
    let metadata = fs::symlink_metadata(&candidate).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err("Symbolic links are not followed".into());
    }
    let canonical_target = fs::canonicalize(&candidate).map_err(|error| error.to_string())?;
    if !canonical_target.starts_with(&canonical_root) {
        return Err("Requested path is outside the allowed root".into());
    }
    Ok(canonical_target)
}

fn relative_display(root: &Path, path: &Path) -> Result<String, String> {
    path.strip_prefix(root)
        .map_err(|_| "Path is outside the allowed root".to_string())
        .map(|relative| relative.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
fn bridge_status(state: State<'_, BridgeState>) -> Result<BridgeStatus, String> {
    let roots = state.roots.lock().map_err(|_| "Root store lock failed")?;
    Ok(BridgeStatus {
        version: env!("CARGO_PKG_VERSION"),
        read_only: true,
        network_enabled: false,
        allowed_root_count: roots.len(),
    })
}

#[tauri::command]
fn list_allowed_roots(state: State<'_, BridgeState>) -> Result<Vec<AllowedRoot>, String> {
    state
        .roots
        .lock()
        .map(|roots| roots.clone())
        .map_err(|_| "Root store lock failed".into())
}

#[tauri::command]
fn choose_allowed_root(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<Option<AllowedRoot>, String> {
    let selected = app.dialog().file().blocking_pick_folder();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected.into_path().map_err(|_| "The selected folder is not a local path")?;
    let canonical = fs::canonicalize(path).map_err(|error| error.to_string())?;
    let metadata = fs::symlink_metadata(&canonical).map_err(|error| error.to_string())?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err("The selected path must be a real directory".into());
    }

    let mut roots = state.roots.lock().map_err(|_| "Root store lock failed")?;
    if let Some(existing) = roots.iter().find(|root| root.path == canonical) {
        return Ok(Some(existing.clone()));
    }
    if roots.len() >= MAX_ROOTS {
        return Err(format!("A maximum of {MAX_ROOTS} allowed roots is supported"));
    }
    let label = canonical
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| canonical.to_string_lossy().into_owned());
    let root = AllowedRoot {
        id: Uuid::new_v4(),
        path: canonical,
        label,
        created_at: Utc::now(),
    };
    roots.push(root.clone());
    persist_roots(&app, &roots)?;
    audit(&app, "allow_root", Some(root.id), None, "allowed", None);
    Ok(Some(root))
}

#[tauri::command]
fn list_directory(
    app: AppHandle,
    state: State<'_, BridgeState>,
    root_id: Uuid,
    relative_path: String,
) -> Result<Vec<FileEntry>, String> {
    let result = (|| {
        let root = find_root(&state, root_id)?;
        let target = resolve_target(&root, &relative_path)?;
        if !target.is_dir() {
            return Err("Requested path is not a directory".into());
        }
        let canonical_root = fs::canonicalize(&root.path).map_err(|error| error.to_string())?;
        let mut entries = Vec::new();
        for entry in fs::read_dir(target).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let metadata = fs::symlink_metadata(entry.path()).map_err(|error| error.to_string())?;
            if metadata.file_type().is_symlink() {
                continue;
            }
            let kind = if metadata.is_dir() { "directory" } else if metadata.is_file() { "file" } else { continue };
            entries.push(FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                relative_path: relative_display(&canonical_root, &entry.path())?,
                kind,
                size: metadata.is_file().then_some(metadata.len()),
            });
        }
        entries.sort_by(|left, right| left.kind.cmp(right.kind).then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase())));
        Ok(entries)
    })();

    match &result {
        Ok(_) => audit(&app, "list_directory", Some(root_id), Some(&relative_path), "allowed", None),
        Err(error) => audit(&app, "list_directory", Some(root_id), Some(&relative_path), "rejected", Some(error.clone())),
    }
    result
}

#[tauri::command]
fn read_text_file(
    app: AppHandle,
    state: State<'_, BridgeState>,
    root_id: Uuid,
    relative_path: String,
    max_bytes: Option<u64>,
) -> Result<String, String> {
    let result = (|| {
        let root = find_root(&state, root_id)?;
        let target = resolve_target(&root, &relative_path)?;
        if !target.is_file() {
            return Err("Requested path is not a file".into());
        }
        let limit = max_bytes.unwrap_or(DEFAULT_MAX_READ_BYTES).min(HARD_MAX_READ_BYTES);
        let metadata = fs::metadata(&target).map_err(|error| error.to_string())?;
        if metadata.len() > limit {
            return Err(format!("File exceeds the read limit of {limit} bytes"));
        }
        let mut file = fs::File::open(target).map_err(|error| error.to_string())?;
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        file.take(limit + 1).read_to_end(&mut bytes).map_err(|error| error.to_string())?;
        if bytes.len() as u64 > limit {
            return Err("File exceeded the read limit while reading".into());
        }
        String::from_utf8(bytes).map_err(|_| "Only UTF-8 text files are supported in foundation mode".into())
    })();

    match &result {
        Ok(_) => audit(&app, "read_text_file", Some(root_id), Some(&relative_path), "allowed", None),
        Err(error) => audit(&app, "read_text_file", Some(root_id), Some(&relative_path), "rejected", Some(error.clone())),
    }
    result
}

#[tauri::command]
fn search_files(
    app: AppHandle,
    state: State<'_, BridgeState>,
    root_id: Uuid,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<FileEntry>, String> {
    let result = (|| {
        let normalized_query = query.trim().to_lowercase();
        if normalized_query.len() < 2 {
            return Err("Search query must contain at least two characters".into());
        }
        let root = find_root(&state, root_id)?;
        let canonical_root = fs::canonicalize(&root.path).map_err(|error| error.to_string())?;
        let result_limit = max_results.unwrap_or(100).min(HARD_MAX_SEARCH_RESULTS);
        let mut entries = Vec::new();
        let mut visited = 0usize;
        let mut seen = HashSet::new();

        for item in WalkDir::new(&canonical_root).follow_links(false).into_iter() {
            let item = item.map_err(|error| error.to_string())?;
            visited += 1;
            if visited > MAX_SEARCHED_ENTRIES {
                break;
            }
            if item.path() == canonical_root || item.file_type().is_symlink() {
                continue;
            }
            let name = item.file_name().to_string_lossy().into_owned();
            if !name.to_lowercase().contains(&normalized_query) {
                continue;
            }
            let canonical = fs::canonicalize(item.path()).map_err(|error| error.to_string())?;
            if !canonical.starts_with(&canonical_root) || !seen.insert(canonical.clone()) {
                continue;
            }
            let metadata = fs::metadata(&canonical).map_err(|error| error.to_string())?;
            entries.push(FileEntry {
                name,
                relative_path: relative_display(&canonical_root, &canonical)?,
                kind: if metadata.is_dir() { "directory" } else { "file" },
                size: metadata.is_file().then_some(metadata.len()),
            });
            if entries.len() >= result_limit {
                break;
            }
        }
        Ok(entries)
    })();

    match &result {
        Ok(_) => audit(&app, "search_files", Some(root_id), None, "allowed", None),
        Err(error) => audit(&app, "search_files", Some(root_id), None, "rejected", Some(error.clone())),
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let roots = load_roots(&app.handle()).unwrap_or_default();
            app.manage(BridgeState { roots: Mutex::new(roots) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge_status,
            list_allowed_roots,
            choose_allowed_root,
            list_directory,
            read_text_file,
            search_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CyberTools Desktop Bridge");
}
