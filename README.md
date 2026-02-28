# Тепловой Баланс — Симуляция Радиатора

## Запуск

1. Установка зависимостей:
   ```bash
   npm install
   ```

2. Режим разработки (Vite dev server):
   ```bash
   npm run dev
   ```
   Откройте в браузере URL, который выведет Vite (обычно http://localhost:5173).

3. Production-сборка и проверка:
   ```bash
   npm run build
   npm run preview
   ```
   Сборка создаётся в папке `dist/`. `preview` запускает локальный сервер для проверки.

**Важно:** Открытие `index.html` напрямую по `file://` не работает — требуется локальный сервер (ES-модули, CORS). Используйте `npm run dev` или `npm run preview`.
