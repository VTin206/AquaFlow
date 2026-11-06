// Keep the initial document usable even when the application bundle cannot be loaded.
void import('./main').catch(() => {
  const title = document.getElementById('af-startup-title')
  const description = document.getElementById('af-startup-description')
  if (title) title.textContent = 'Không khởi động được AquaFlow'
  if (description) description.textContent = 'Kiểm tra kết nối mạng rồi tải lại trang. Nếu vẫn gặp lỗi, vui lòng thử lại sau.'
})
