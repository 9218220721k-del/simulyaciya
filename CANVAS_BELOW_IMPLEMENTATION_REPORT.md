# Отчёт: Пустой canvas под радиатором во вкладке Визуализация

**Проект:** SIMULACIA (симуляция радиатора)  
**Путь:** `симуляция/SIMULACIA/`  
**Дата:** 2026-02-23

---

## 1. Задача

Добавить второй пустой canvas под основным canvas с радиатором во вкладке «Визуализация». Размеры нижнего canvas должны совпадать с размерами основного (ширина и высота).

---

## 2. Контекст проекта

- **Основной canvas:** `#simCanvas` в `#canvas-section` — рисует радиатор, трубы, частицы
- **Размеры:** хранятся в `state.ts` — `st.canvasWidth`, `st.canvasHeight` (по умолчанию 1600×850 px)
- **Вкладка Визуализация:** `#visualization-section` — показывается по кнопке «Визуализация»
- **Стили canvas:** класс `canvas-container` в `styles.css` — градиентный фон, скругления, тень

---

## 3. Изменения по файлам

### 3.1. index.html

**Место вставки:** после блока `#canvas-section`, внутри `#visualization-section` (перед закрывающим `</div>` секции).

**Добавленный HTML (строки 467–470):**

```html
<!-- ========== ПУСТОЙ CANVAS (под радиатором) ========== -->
<div id="canvas-below-section" class="canvas-container mb-8">
  <canvas id="simCanvasBelow"></canvas>
</div>
```

**Полный контекст (как должно выглядеть):**

```html
<!-- ========== CANVAS ========== -->
<div id="canvas-section" class="canvas-container mb-8"><canvas id="simCanvas"></canvas></div>

<!-- ========== ПУСТОЙ CANVAS (под радиатором) ========== -->
<div id="canvas-below-section" class="canvas-container mb-8">
  <canvas id="simCanvasBelow"></canvas>
</div>
</div>

<!-- ========== БЛОК: Температура коллектора обратки ========== -->
```

---

### 3.2. main.ts

#### 3.2.1. Функция syncCanvasBelowSize()

**Место:** после `debouncedRecalc()`, перед `saveSettings()` (примерно строки 54–60).

**Код:**

```typescript
function syncCanvasBelowSize(): void {
  const canvasBelow = document.getElementById('simCanvasBelow') as HTMLCanvasElement | null;
  if (canvasBelow) {
    canvasBelow.width = st.canvasWidth;
    canvasBelow.height = st.canvasHeight;
  }
}
```

**Назначение:** синхронизирует размеры `#simCanvasBelow` с основным canvas.

---

#### 3.2.2. Вызов syncCanvasBelowSize() в init()

**Место:** в функции `init()`, сразу после `st.initCanvasContext(canvas)`.

**Было:**
```typescript
  canvas.width = st.canvasWidth;
  canvas.height = st.canvasHeight;
  st.initCanvasContext(canvas);
  for (let i = 0; i < 1000; i++) st.particles.push(new Particle());
```

**Стало:**
```typescript
  canvas.width = st.canvasWidth;
  canvas.height = st.canvasHeight;
  st.initCanvasContext(canvas);
  syncCanvasBelowSize();
  for (let i = 0; i < 1000; i++) st.particles.push(new Particle());
```

---

#### 3.2.3. Вызов syncCanvasBelowSize() в loadSettings()

**Место 1 — при загрузке canvasHeight (строки 287–294):**

```typescript
    if (typeof s.canvasHeight === 'number' && s.canvasHeight >= 700 && s.canvasHeight <= 1050) {
      st.setCanvasHeight(s.canvasHeight);
      const chEl = document.getElementById('canvas-height') as HTMLInputElement;
      if (chEl) chEl.value = String(st.canvasHeight);
      const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
      if (canvas) canvas.height = st.canvasHeight;
      syncCanvasBelowSize();
    }
```

**Место 2 — при загрузке canvasWidth (строки 295–301):**

```typescript
    if (typeof s.canvasWidth === 'number' && s.canvasWidth >= 1000 && s.canvasWidth <= 2000) {
      st.setCanvasWidth(s.canvasWidth);
      const cwEl = document.getElementById('canvas-width') as HTMLInputElement;
      if (cwEl) cwEl.value = String(st.canvasWidth);
      const canvas = document.getElementById('simCanvas') as HTMLCanvasElement;
      if (canvas) canvas.width = st.canvasWidth;
      syncCanvasBelowSize();
    }
```

---

#### 3.2.4. Вызов syncCanvasBelowSize() в функциях изменения размеров

**adjustCanvasWidth()** — после `canvas.width = st.canvasWidth`:
```typescript
  canvas.width = st.canvasWidth;
  syncCanvasBelowSize();
  saveSettings();
```

**applyCanvasWidth()** — после `canvas.width = st.canvasWidth`:
```typescript
  canvas.width = st.canvasWidth;
  syncCanvasBelowSize();
  saveSettings();
```

**adjustCanvasHeight()** — после `canvas.height = st.canvasHeight`:
```typescript
  canvas.height = st.canvasHeight;
  syncCanvasBelowSize();
  saveSettings();
```

**applyCanvasHeight()** — после `canvas.height = st.canvasHeight`:
```typescript
  canvas.height = st.canvasHeight;
  syncCanvasBelowSize();
  saveSettings();
```

---

## 4. Идентификаторы и DOM

| Элемент | ID | Описание |
|---------|-----|----------|
| Контейнер нижнего canvas | `canvas-below-section` | div с классом `canvas-container` |
| Canvas | `simCanvasBelow` | пустой canvas, размеры = st.canvasWidth × st.canvasHeight |

---

## 5. Что НЕ изменялось

- **state.ts** — без изменений (используются `st.canvasWidth`, `st.canvasHeight`)
- **draw.ts** — без изменений (нижний canvas не рисуется)
- **gameLoop** — без изменений
- **styles.css** — без изменений (используется существующий `canvas-container`)

---

## 6. Логика работы

1. При загрузке страницы `init()` вызывает `syncCanvasBelowSize()` — нижний canvas получает размеры основного.
2. При изменении ширины/высоты через контролы «Размеры и позиция» вызываются `applyCanvasWidth()` / `applyCanvasHeight()` или `adjustCanvasWidth()` / `adjustCanvasHeight()` — в них вызывается `syncCanvasBelowSize()`.
3. При загрузке настроек из localStorage в `loadSettings()` при восстановлении `canvasWidth` и `canvasHeight` вызывается `syncCanvasBelowSize()`.
4. Нижний canvas остаётся пустым — на нём нет вызовов рисования из `draw.ts` или `gameLoop`.

---

## 7. Резюме для другого ИИ

**Задача:** Добавить пустой canvas под радиатором во вкладке Визуализация с теми же размерами, что и основной canvas.

**Правки:**
1. `index.html` — добавить блок `#canvas-below-section` с `#simCanvasBelow` после `#canvas-section`.
2. `main.ts` — добавить функцию `syncCanvasBelowSize()` и вызывать её в `init()`, `loadSettings()` (при загрузке canvasWidth и canvasHeight), `adjustCanvasWidth()`, `applyCanvasWidth()`, `adjustCanvasHeight()`, `applyCanvasHeight()`.

**Доступ к canvas:** `document.getElementById('simCanvasBelow') as HTMLCanvasElement`

**Контекст для рисования (если понадобится):** `canvas.getContext('2d')` — canvas пустой, но 2D-контекст доступен.
