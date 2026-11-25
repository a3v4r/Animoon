<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
    <img src=".github/assets/logo-light.svg" alt="Animoon" width="420">
  </picture>
</h1>

Неофициальный клиент [AniLiberty](https://aniliberty.top) (бывшая AniLibria) для Windows, Linux и macOS.
С командой AniLiberty не связан, всё берётся из их открытого API.

![Каталог](.github/assets/catalog.jpg)

Что умеет: каталог с фильтрами, расписание, избранное, плеер с выбором качества и пропуском опенинга,
синхронизация просмотренного с аккаунтом, уведомления о новых сериях, автообновление.

## Установка

Скачать со страницы [Releases](https://github.com/a3v4r/animoon/releases).

- Windows: `*-setup.exe`. Установщик не подписан, SmartScreen попросит нажать «Подробнее» и «Выполнить в любом случае».
- macOS: `*.dmg`, подходит и для Apple Silicon, и для Intel. При первом запуске разрешить открытие в
  «Конфиденциальность и безопасность».
- Linux: `.deb`, `.rpm` или `.AppImage`. Для видео нужен GStreamer (`gstreamer1.0-plugins-good`, `-bad`,
  `gstreamer1.0-libav`), deb ставит его сам. Нужна Ubuntu 22.04 / Debian 12 или новее.

Дальше обновляется само.

## Клавиши в плеере

| | |
|---|---|
| `Space` / `K` | пауза |
| `←` `→` | 5 секунд назад / вперёд |
| `J` `L` | 10 секунд назад / вперёд |
| `↑` `↓` | громкость |
| `M` | звук |
| `F` | полный экран |
| `N` | следующая серия |
| `S` | пропустить опенинг |

## Сборка

Нужны Node.js 20.19+ или 22.12+, pnpm 9, Rust 1.90+ и [зависимости Tauri](https://v2.tauri.app/start/prerequisites/)
для своей ОС.

```bash
pnpm install
pnpm tauri dev
pnpm tauri build
```

Tauri 2, Vue 3, TypeScript, Vuetify, hls.js. CSP работает только в собранном приложении, так что проверять
его надо через `pnpm tauri build --debug`.

Релиз: поднять версию в `package.json`, `src-tauri/tauri.conf.json` и `src-tauri/Cargo.toml`, запушить тег
`vX.Y.Z`. CI соберёт черновик релиза под все три системы, его остаётся проверить и опубликовать. Для подписи
обновлений в секретах репозитория нужны `TAURI_SIGNING_PRIVATE_KEY` и `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

Старая версия на Electron лежит под тегом `electron-1.6.8`.

## Лицензия

[MIT](LICENSE). Началось как форк [AniLibrix](https://github.com/pavloniym/anilibrix), с тех пор код переписан
с нуля. Шрифты Onest и Unbounded под SIL Open Font License, иконки Material Design Icons под Apache 2.0.
