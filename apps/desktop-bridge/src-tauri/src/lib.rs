use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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
const PAIRING_TTL_SECONDS: i64 = 5 * 60;
const SESSION_TTL_SECONDS: i64 = 30 * 60;
const LOOPBACK_ORIGINS: &[&str] = &["http://localhost", "http://127.0.0.1", "http://[::1]"];
const READ_ONLY_CAPABILITIES: &[&str] =
    &["filesystem.list", "filesystem.read", "filesystem.search"];
const DENIED_CAPABILITIES: &[&str] = &[
    "filesystem.write",
    "filesystem.delete",
    "filesystem.rename",
    "process.execute",
    "terminal.open",
    "network.listen",
];

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

#[derive(Debug, Serialize, Clone)]
struct PairingOffer {
    pairing_id: Uuid,
    pairing_code: String,
    confirmation_fingerprint: String,
    expires_at: DateTime<Utc>,
    capabilities: Vec<&'static str>,
    denied_capabilities: Vec<&'static str>,
    transport: &'static str,
}

#[derive(Debug, Serialize, Clone)]
struct PairingSession {
    session_id: Uuid,
    pairing_id: Uuid,
    confirmation_fingerprint: String,
    capabilities: Vec<&'static str>,
    created_at: DateTime<Utc>,
    expires_at: DateTime<Utc>,
    revoked_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Clone)]
struct PairingStatus {
    offer: Option<PairingOffer>,
    session: Option<PairingSession>,
}

#[derive(Debug, Clone)]
struct PairingOfferState {
    offer: PairingOffer,
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
    pairing_offer: Mutex<Option<PairingOfferState>>,
    pairing_session: Mutex<Option<PairingSession>>,
}

fn pairing_code_from_uuid(id: Uuid) -> String {
    let mut value = 0u32;
    for byte in id.as_bytes().iter().take(4) {
        value = (value << 8) | u32::from(*byte);
    }
    format!("{:08}", value % 100_000_000)
}

fn fingerprint_for(pairing_id: Uuid, pairing_code: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(pairing_id.as_bytes());
    hasher.update(pairing_code.as_bytes());
    let digest = hasher.finalize();
    digest
        .iter()
        .take(6)
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(":")
}

fn is_loopback_origin(origin: &str) -> bool {
    LOOPBACK_ORIGINS.iter().any(|allowed| {
        origin == *allowed
            || origin
                .strip_prefix(allowed)
                .is_some_and(|suffix| suffix.starts_with(':') || suffix.starts_with('/'))
    })
}

fn ensure_read_only_capabilities(requested: &[String]) -> Result<(), String> {
    let allowed: HashSet<&str> = READ_ONLY_CAPABILITIES.iter().copied().collect();
    for capability in requested {
        if !allowed.contains(capability.as_str()) {
            return Err(format!("Capability is not allowed: {capability}"));
        }
    }
    Ok(())
}

fn active_pairing_status(state: &BridgeState, now: DateTime<Utc>) -> Result<PairingStatus, String> {
    let offer = state
        .pairing_offer
        .lock()
        .map_err(|_| "Pairing offer lock failed")?
        .as_ref()
        .filter(|offer| offer.offer.expires_at > now)
        .map(|offer| offer.offer.clone());
    let session = state
        .pairing_session
        .lock()
        .map_err(|_| "Pairing session lock failed")?
        .as_ref()
        .filter(|session| session.revoked_at.is_none() && session.expires_at > now)
        .cloned();
    Ok(PairingStatus { offer, session })
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
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

fn reject_symlink_components(root: &Path, relative_path: &Path) -> Result<(), String> {
    let mut cursor = root.to_path_buf();
    for component in relative_path.components() {
        if let Component::Normal(segment) = component {
            cursor.push(segment);
            let metadata = fs::symlink_metadata(&cursor).map_err(|error| error.to_string())?;
            if metadata.file_type().is_symlink() {
                return Err("Symbolic links are not followed".into());
            }
        }
    }
    Ok(())
}

fn resolve_target(root: &AllowedRoot, relative_path: &str) -> Result<PathBuf, String> {
    let safe_relative = validate_relative_path(relative_path)?;
    let canonical_root = fs::canonicalize(&root.path).map_err(|error| error.to_string())?;
    reject_symlink_components(&canonical_root, &safe_relative)?;
    let candidate = canonical_root.join(safe_relative);
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
fn pairing_status(state: State<'_, BridgeState>) -> Result<PairingStatus, String> {
    active_pairing_status(&state, Utc::now())
}

#[tauri::command]
fn create_pairing_offer(
    app: AppHandle,
    state: State<'_, BridgeState>,
) -> Result<PairingOffer, String> {
    let now = Utc::now();
    let pairing_id = Uuid::new_v4();
    let pairing_code = pairing_code_from_uuid(pairing_id);
    let offer = PairingOffer {
        pairing_id,
        confirmation_fingerprint: fingerprint_for(pairing_id, &pairing_code),
        pairing_code,
        expires_at: now + chrono::Duration::seconds(PAIRING_TTL_SECONDS),
        capabilities: READ_ONLY_CAPABILITIES.to_vec(),
        denied_capabilities: DENIED_CAPABILITIES.to_vec(),
        transport: "loopback-or-outbound-only",
    };
    *state
        .pairing_offer
        .lock()
        .map_err(|_| "Pairing offer lock failed")? = Some(PairingOfferState {
        offer: offer.clone(),
    });
    audit(
        &app,
        "pairing_offer",
        None,
        None,
        "allowed",
        Some(format!("pairing_id={}", offer.pairing_id)),
    );
    Ok(offer)
}

#[tauri::command]
fn confirm_pairing_code(
    app: AppHandle,
    state: State<'_, BridgeState>,
    pairing_id: Uuid,
    pairing_code: String,
    web_origin: String,
    requested_capabilities: Vec<String>,
) -> Result<PairingSession, String> {
    let result: Result<PairingSession, String> = (|| {
        if !is_loopback_origin(&web_origin) {
            return Err(
                "Pairing confirmation is restricted to loopback or outbound-only flows".into(),
            );
        }
        ensure_read_only_capabilities(&requested_capabilities)?;
        let now = Utc::now();
        let mut offer_guard = state
            .pairing_offer
            .lock()
            .map_err(|_| "Pairing offer lock failed")?;
        let Some(offer_state) = offer_guard.as_ref() else {
            return Err("No active pairing offer".into());
        };
        if offer_state.offer.pairing_id != pairing_id {
            return Err("Pairing offer does not match".into());
        }
        if offer_state.offer.expires_at <= now {
            return Err("Pairing offer expired".into());
        }
        if offer_state.offer.pairing_code != pairing_code {
            return Err("Pairing code was rejected".into());
        }
        let session = PairingSession {
            session_id: Uuid::new_v4(),
            pairing_id,
            confirmation_fingerprint: offer_state.offer.confirmation_fingerprint.clone(),
            capabilities: READ_ONLY_CAPABILITIES.to_vec(),
            created_at: now,
            expires_at: now + chrono::Duration::seconds(SESSION_TTL_SECONDS),
            revoked_at: None,
        };
        *state
            .pairing_session
            .lock()
            .map_err(|_| "Pairing session lock failed")? = Some(session.clone());
        *offer_guard = None;
        Ok(session)
    })();

    match &result {
        Ok(session) => audit(
            &app,
            "pairing_confirm",
            None,
            None,
            "allowed",
            Some(format!("session_id={}", session.session_id)),
        ),
        Err(error) => audit(
            &app,
            "pairing_confirm",
            None,
            None,
            "rejected",
            Some(error.clone()),
        ),
    }
    result
}

#[tauri::command]
fn revoke_pairing_session(app: AppHandle, state: State<'_, BridgeState>) -> Result<(), String> {
    let mut session = state
        .pairing_session
        .lock()
        .map_err(|_| "Pairing session lock failed")?;
    if let Some(current) = session.as_mut() {
        current.revoked_at = Some(Utc::now());
        audit(
            &app,
            "pairing_revoke",
            None,
            None,
            "allowed",
            Some(format!("session_id={}", current.session_id)),
        );
    }
    Ok(())
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
    let path = selected
        .into_path()
        .map_err(|_| "The selected folder is not a local path")?;
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
        return Err(format!(
            "A maximum of {MAX_ROOTS} allowed roots is supported"
        ));
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
    if let Err(error) = persist_roots(&app, &roots) {
        roots.pop();
        return Err(error);
    }
    audit(&app, "allow_root", Some(root.id), None, "allowed", None);
    Ok(Some(root))
}

#[tauri::command]
fn remove_allowed_root(
    app: AppHandle,
    state: State<'_, BridgeState>,
    root_id: Uuid,
) -> Result<(), String> {
    let mut roots = state.roots.lock().map_err(|_| "Root store lock failed")?;
    let Some(index) = roots.iter().position(|root| root.id == root_id) else {
        audit(
            &app,
            "revoke_root",
            Some(root_id),
            None,
            "rejected",
            Some("Allowed root was not found".into()),
        );
        return Err("Allowed root was not found".into());
    };
    let removed = roots.remove(index);
    if let Err(error) = persist_roots(&app, &roots) {
        roots.insert(index, removed);
        audit(
            &app,
            "revoke_root",
            Some(root_id),
            None,
            "rejected",
            Some(error.clone()),
        );
        return Err(error);
    }
    audit(&app, "revoke_root", Some(root_id), None, "allowed", None);
    Ok(())
}

#[tauri::command]
fn list_directory(
    app: AppHandle,
    state: State<'_, BridgeState>,
    root_id: Uuid,
    relative_path: String,
) -> Result<Vec<FileEntry>, String> {
    let result: Result<Vec<FileEntry>, String> = (|| {
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
            let kind = if metadata.is_dir() {
                "directory"
            } else if metadata.is_file() {
                "file"
            } else {
                continue;
            };
            entries.push(FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                relative_path: relative_display(&canonical_root, &entry.path())?,
                kind,
                size: metadata.is_file().then_some(metadata.len()),
            });
        }
        entries.sort_by(|left, right| {
            left.kind
                .cmp(right.kind)
                .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
        });
        Ok(entries)
    })();

    match &result {
        Ok(_) => audit(
            &app,
            "list_directory",
            Some(root_id),
            Some(&relative_path),
            "allowed",
            None,
        ),
        Err(error) => audit(
            &app,
            "list_directory",
            Some(root_id),
            Some(&relative_path),
            "rejected",
            Some(error.clone()),
        ),
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
    let result: Result<String, String> = (|| {
        let root = find_root(&state, root_id)?;
        let target = resolve_target(&root, &relative_path)?;
        if !target.is_file() {
            return Err("Requested path is not a file".into());
        }
        let limit = max_bytes
            .unwrap_or(DEFAULT_MAX_READ_BYTES)
            .min(HARD_MAX_READ_BYTES);
        let metadata = fs::metadata(&target).map_err(|error| error.to_string())?;
        if metadata.len() > limit {
            return Err(format!("File exceeds the read limit of {limit} bytes"));
        }
        let file = fs::File::open(target).map_err(|error| error.to_string())?;
        let mut bytes = Vec::with_capacity(metadata.len() as usize);
        file.take(limit + 1)
            .read_to_end(&mut bytes)
            .map_err(|error| error.to_string())?;
        if bytes.len() as u64 > limit {
            return Err("File exceeded the read limit while reading".into());
        }
        String::from_utf8(bytes)
            .map_err(|_| "Only UTF-8 text files are supported in foundation mode".into())
    })();

    match &result {
        Ok(_) => audit(
            &app,
            "read_text_file",
            Some(root_id),
            Some(&relative_path),
            "allowed",
            None,
        ),
        Err(error) => audit(
            &app,
            "read_text_file",
            Some(root_id),
            Some(&relative_path),
            "rejected",
            Some(error.clone()),
        ),
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
    let result: Result<Vec<FileEntry>, String> = (|| {
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

        for item in WalkDir::new(&canonical_root)
            .follow_links(false)
            .into_iter()
        {
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
                kind: if metadata.is_dir() {
                    "directory"
                } else {
                    "file"
                },
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
        Err(error) => audit(
            &app,
            "search_files",
            Some(root_id),
            None,
            "rejected",
            Some(error.clone()),
        ),
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(path: PathBuf) -> AllowedRoot {
        AllowedRoot {
            id: Uuid::new_v4(),
            path,
            label: "test-root".to_string(),
            created_at: Utc::now(),
        }
    }

    fn temp_case(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "cybertools-desktop-bridge-{name}-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&path).expect("create temp root");
        path
    }

    #[test]
    fn rejects_traversal_and_absolute_paths() {
        assert!(validate_relative_path("../secret.txt").is_err());
        assert!(validate_relative_path("safe/../../secret.txt").is_err());
        assert!(validate_relative_path(r"C:\Windows\win.ini").is_err());
        assert!(validate_relative_path(r"\Windows\win.ini").is_err());
    }

    #[test]
    fn resolves_files_inside_allowed_root() {
        let root_path = temp_case("inside");
        let nested = root_path.join("nested");
        fs::create_dir_all(&nested).expect("create nested directory");
        fs::write(nested.join("note.txt"), "hello").expect("write fixture");

        let root = test_root(root_path.clone());
        let resolved = resolve_target(&root, "nested/note.txt").expect("resolve target");

        assert_eq!(
            resolved,
            fs::canonicalize(nested.join("note.txt")).expect("canonical fixture")
        );
        fs::remove_dir_all(root_path).expect("cleanup temp root");
    }

    #[test]
    fn rejects_symlink_components_when_supported() {
        let root_path = temp_case("symlink");
        let outside_path = temp_case("outside");
        let outside_file = outside_path.join("secret.txt");
        fs::write(&outside_file, "secret").expect("write outside fixture");
        let link_path = root_path.join("link.txt");

        #[cfg(windows)]
        let symlink_result = std::os::windows::fs::symlink_file(&outside_file, &link_path);
        #[cfg(unix)]
        let symlink_result = std::os::unix::fs::symlink(&outside_file, &link_path);

        if symlink_result.is_ok() {
            let root = test_root(root_path.clone());
            assert!(resolve_target(&root, "link.txt").is_err());
        }

        fs::remove_dir_all(root_path).expect("cleanup root");
        fs::remove_dir_all(outside_path).expect("cleanup outside");
    }

    #[test]
    fn rejects_pairing_capability_escalation() {
        assert!(ensure_read_only_capabilities(&[
            "filesystem.list".to_string(),
            "filesystem.read".to_string(),
        ])
        .is_ok());
        assert!(ensure_read_only_capabilities(&["filesystem.write".to_string()]).is_err());
        assert!(ensure_read_only_capabilities(&["network.listen".to_string()]).is_err());
    }

    #[test]
    fn pairing_fingerprint_detects_tampering() {
        let pairing_id = Uuid::new_v4();
        let code = pairing_code_from_uuid(pairing_id);
        let fingerprint = fingerprint_for(pairing_id, &code);

        assert_eq!(fingerprint, fingerprint_for(pairing_id, &code));
        assert_ne!(fingerprint, fingerprint_for(pairing_id, "00000000"));
        assert_ne!(fingerprint, fingerprint_for(Uuid::new_v4(), &code));
    }

    #[test]
    fn pairing_status_filters_expired_and_revoked_state() {
        let now = Utc::now();
        let active_offer = PairingOffer {
            pairing_id: Uuid::new_v4(),
            pairing_code: "12345678".into(),
            confirmation_fingerprint: "AA:BB:CC:DD:EE:FF".into(),
            expires_at: now + chrono::Duration::seconds(1),
            capabilities: READ_ONLY_CAPABILITIES.to_vec(),
            denied_capabilities: DENIED_CAPABILITIES.to_vec(),
            transport: "loopback-or-outbound-only",
        };
        let state = BridgeState {
            roots: Mutex::new(Vec::new()),
            pairing_offer: Mutex::new(Some(PairingOfferState {
                offer: active_offer.clone(),
            })),
            pairing_session: Mutex::new(Some(PairingSession {
                session_id: Uuid::new_v4(),
                pairing_id: active_offer.pairing_id,
                confirmation_fingerprint: active_offer.confirmation_fingerprint.clone(),
                capabilities: READ_ONLY_CAPABILITIES.to_vec(),
                created_at: now,
                expires_at: now + chrono::Duration::seconds(1),
                revoked_at: None,
            })),
        };

        let active = active_pairing_status(&state, now).expect("active status");
        assert!(active.offer.is_some());
        assert!(active.session.is_some());

        let expired = active_pairing_status(&state, now + chrono::Duration::seconds(2))
            .expect("expired status");
        assert!(expired.offer.is_none());
        assert!(expired.session.is_none());

        state
            .pairing_session
            .lock()
            .expect("session lock")
            .as_mut()
            .expect("session")
            .revoked_at = Some(now);
        let revoked = active_pairing_status(&state, now).expect("revoked status");
        assert!(revoked.session.is_none());
    }

    #[test]
    fn loopback_origin_only_blocks_public_confirmation() {
        assert!(is_loopback_origin("http://localhost:5173"));
        assert!(is_loopback_origin("http://127.0.0.1:5173"));
        assert!(!is_loopback_origin("https://example.com"));
        assert!(!is_loopback_origin("http://192.168.1.10:5173"));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let roots = load_roots(app.handle()).unwrap_or_default();
            app.manage(BridgeState {
                roots: Mutex::new(roots),
                pairing_offer: Mutex::new(None),
                pairing_session: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            bridge_status,
            pairing_status,
            create_pairing_offer,
            confirm_pairing_code,
            revoke_pairing_session,
            list_allowed_roots,
            choose_allowed_root,
            remove_allowed_root,
            list_directory,
            read_text_file,
            search_files
        ])
        .run(tauri::generate_context!())
        .expect("failed to run CyberTools Desktop Bridge");
}
