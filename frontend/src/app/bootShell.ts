/** Khung tĩnh trong index.html: gỡ đúng lúc trang thật đã dựng xong để không chớp trống. */
export const removeBootShell = () => document.getElementById('af-boot')?.remove()

/** Trang công khai đang mở có khung tĩnh hay không (index.html quyết định theo đường dẫn). */
export const bootShellPage = () => document.documentElement.dataset.boot
