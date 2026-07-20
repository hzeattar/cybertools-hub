# إضافات مطلوبة على ملف .env

> ملاحظة: أداة التحرير لدي ممنوعة أمنياً من فتح/تعديل ملف `.env` مباشرة (لحماية أسرارك).
> لذلك يجب عليك نسخ الأسطر التالية يدوياً وإضافتها/تفعيلها في ملف `.env` الموجود لديك.

## المهمة 1: RAG (الذاكرة المؤسسية)
ملف `.env.example` يحتوي على هذه الأسطر بالفعل لكنها معطّلة (comment). قم بإلغاء التعليق `#` وتعبئة القيم:

```env
RAG_API_URL=http://rag_api:8000
RAG_OPENAI_API_KEY=sk-your-openai-api-key
EMBEDDINGS_PROVIDER=openai
EMBEDDINGS_MODEL=text-embedding-3-small
```

كما تم تحديث `docker-compose.yml` بحيث تستخدم خدمة `vectordb` قاعدة بيانات باسم `librechat` بدلاً من القيم الافتراضية `mydatabase/myuser/mypassword`، تأكد من مطابقة كلمة المرور في `.env` إذا احتجت لتغييرها:

```env
POSTGRES_DB=librechat
POSTGRES_USER=librechat
POSTGRES_PASSWORD=YourStrongPassword
```

## المهمة 3: تفعيل أداة البحث في الويب
اختر أحد الخيارين (أو كليهما) في `.env`:

### Tavily (موصى به لأنه مصمم خصيصاً للـ Agents)
```env
TAVILY_API_KEY=your_tavily_api_key
```

### Google Custom Search
```env
GOOGLE_SEARCH_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_google_search_engine_id
```

بعد إضافة أي منهما، فعّل أداة "Web Search" من إعدادات الـ Agent في الواجهة (Agent Builder -> Tools -> Web Search).

## ملاحظة عن Ollama (المهمة 2)
لا يحتاج Ollama أي متغيرات في `.env` لأن الاتصال به داخلي عبر شبكة Docker (`http://ollama:11434/v1`)، تم ضبط كل شيء في `docker-compose.yml` و `librechat.yaml`.

بعد أول تشغيل، نزّل النماذج داخل الحاوية:
```bash
docker exec -it ollama ollama pull llama3
docker exec -it ollama ollama pull codellama
```
