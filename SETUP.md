# הקמה: מהמאגר לאתר מקוון

בלי ההגדרות שלמטה האתר עולה ב"מצב מקומי": משחק ליחיד, בלי שרת ובלי הגנה. כדי לעבור למצב מקוון:

## 1. פרויקט בסופאבייס
1. צור פרויקט חדש ושמור את סיסמת מסד הנתונים.
2. Authentication → Sign In / Providers: הפעל Anonymous sign-ins. מומלץ להפעיל גם CAPTCHA.
3. Authentication → URL Configuration: הגדר את כתובת האתר (למשל `https://lidorfiliba.github.io/eternal-cycle/`) ב-Site URL וב-Redirect URLs.
4. Account → Access Tokens: צור טוקן אישי.

## 2. הגדרות במאגר בגיטהאב (Settings → Secrets and variables → Actions)
Secrets:
- `SUPABASE_ACCESS_TOKEN` — הטוקן האישי
- `SUPABASE_DB_PASSWORD` — סיסמת מסד הנתונים

Variables:
- `SUPABASE_PROJECT_REF` — מזהה הפרויקט (החלק שלפני `.supabase.co`)
- `SUPABASE_ANON_KEY` — מפתח ה-anon (ציבורי)

## 3. אתר
Settings → Pages → Source: GitHub Actions.

## 4. פריסה
Actions → deploy → Run workflow (או כל דחיפה ל-main). התהליך מריץ בדיקות, מעלה את מסד הנתונים ואת פונקציית השרת, ומפרסם את האתר.

## בדיקה אחרי הפריסה
- בתחתית המסך כתוב "מחובר לשרת".
- פתח את כלי המפתחים, שנה ב-`EC.A.gold` את הזהב, ובצע פעולה כלשהי: הערך חוזר למה שבשרת.
- בסופאבייס, טבלת `audit` מציגה דיווחים שנחתכו, והתצוגה `suspects` מרכזת חשודים.
