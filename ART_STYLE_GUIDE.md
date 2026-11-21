# Traffino — художественный стиль

Тёплый игрушечный город, кремовые карнизы, коралловые и мятные фасады, крупные витрины, полосатые навесы. Пользовательские изображения задают направление; город состоит из настоящей геометрии и сохраняет объём при вращении камеры.

## Палитра и материалы

Основные цвета: кремовый `#ffe7b0`, песочный `#e8cfa4`, коралл `#de7058`, мята `#72b8ac`, жёлтый `#ebbc55`, лайм `#b8bd67`, сливовые тени `#785463`, стекло `#476674`. Дорога приглушённая, STOP/GO также подписаны текстом. Матовые MeshStandardMaterial, мягкие фаски; прозрачные поверхности не применяются к игровому транспорту.

## Состав

- `src/art.js`: город, фасады и 13 моделей транспорта. Пиццерия с объёмной пиццей, кофейня с чашкой, магазин с ящиками фруктов, балконы, цветы, кондиционеры, антенны, остановка, столики, лавочки, деревья, фонари.
- `src/view.js`: общие геометрии и материалы, инстансы, персонаж, свет, анимация, камера, ограниченный пул эффектов. Автомобиль смотрит вдоль локального +Z; коллизионные габариты берутся из конфигурации.
- `src/ui.js`, `src/styles.css`: мультяшная эмблема, объёмная зелёная кнопка, карточки с транспортом, округлая типографика Nunito, связанные по палитре панели и HUD. Живой город справа сохранён.
- `public/assets`: локальные изображения и шрифт, включаемые в release. `references`: исходные листы пользователя, не входят в ZIP. `artifacts`: проверочные кадры и отчёты, не входят в ZIP.

Названия моделей совпадают с ключами `VEHICLES`; роли деталей — body, headlight, brake, indicator, siren. Изображения именуются по назначению, а не по дате.

## Свет и движение

Восемь ключевых кадров суток интерполируют небо, солнце, окружение и интенсивность света. Солнце меняет угол. Ночью включаются группы окон с разной яркостью, витрины, фонари, фары и мягкий ореол пиццерии. ACES tone mapping, лёгкая виньетка и прозрачные световые пятна заменяют дорогой fullscreen bloom. Тени PCFSoft на Medium/High; цветовые предупреждения остаются на Low.

Автомобили: вращение колёс, поворот передних колёс, наклон и клевок корпуса, подвеска, стоп-сигналы, поворотники, маяки. Регулировщик: короткие GO/STOP, переключение внимания, свисток, опасность, облегчение, столкновение, радость, моргание и ночная поза. Пешеходы шагают и покачиваются в ожидании; декоративные прохожие и птицы не участвуют в правилах игры. При паузе транспорт заморожен; персонаж может мягко дышать. UI уважает prefers-reduced-motion.

## Происхождение ассетов

`miro-portrait.jpg` — отдельная иллюстрация Миро для инструктажа и рации. Создана с помощью ImageGen для Traffino. Тёмная тушь, шероховатая печать и выцветшая бирюза связывают портрет с городской служебной карточкой. У персонажа на перекрёстке те же брови, усы и фуражка.

`junior-vehicles.png` и `junior-shops.png` взяты из предоставленного пользователем `junior_city_2d_image_pack.zip`: автомобили — карточки режимов, магазины — карточки районов. Остальные листы служат референсами для собственных 3D-моделей. В README архива отдельная лицензия не указана.

Nunito: [Google Fonts](https://github.com/google/fonts/tree/main/ofl/nunito), SIL OFL 1.1. Лицензия включена в `public/assets/Nunito-OFL.txt` и архив игры. Внешней загрузки шрифта во время игры нет.

`traffino-logo.png`: оригинальная эмблема, созданная встроенным imagegen для этой игры, без использования логотипов других игр. Оригинальный файл сохранён также в каталоге generated_images Codex. Промпт генерации:

> Create one production game-logo illustration on a genuinely transparent alpha background for an original cozy traffic-control game called TRAFFINO. NOT a UI mockup. A wide horizontal compact logo, aspect 2:1, isolated clean cutout filling the image with just 4% transparent padding. Exact text: TRAFFINO, spelled T R A F F I N O, one line, extremely legible big chunky playful rounded 3D toy lettering, warm ivory/yellow faces, deep teal extrusion, cream outline, slightly arched arrangement and subtle individual letter angles. Under the word a small integrated curved dark teal toy road with a few ivory dashed markings. Above/behind the left quarter of the letters a charming original toy traffic marshal bust with rounded head, friendly face, teal uniform and cap with a small golden badge, white glove raised in a wave; next to the right edge a cute little golden yellow toy taxi, one red-yellow-green traffic light. All ornaments integrated into one tight silhouette, subordinate to word. Polished premium stylized low-poly / soft-beveled toy-city 3D render, lovely warm studio lighting, soft dimensional shadows within objects, warm cream, coral, sunny yellow, mint and teal colors. Match a cozy miniature city with colorful low-poly buildings, cream cornices, striped shop awnings and tiny cars. High charm and craftsmanship, friendly commercial casual game identity, no flat minimal corporate styling, no realistic gritty police details, no checkerboard, no opaque backdrop, no extra words, no logos from existing games, no watermark. The image will be displayed at 450px wide above actual interactive menu buttons; prioritize strong readable shapes.
