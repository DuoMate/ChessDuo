(function () {
  try {
    var t = JSON.parse(localStorage.getItem('chessduo_settings') || '{}').theme
    if (!t || t === 'dark') document.documentElement.classList.add('dark')
  } catch (e) {
    document.documentElement.classList.add('dark')
  }
})()
