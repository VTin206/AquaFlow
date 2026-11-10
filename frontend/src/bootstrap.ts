// Không có màn hình chờ: chỉ hiện thông báo lỗi có sẵn trong index.html khi không tải được app.
void import('./main').catch(() => {
  document.getElementById('af-startup')?.setAttribute('data-state', 'failed')
})
