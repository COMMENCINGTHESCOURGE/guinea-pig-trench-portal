// Guinea Pig Trench — SPA Router
// Handles page switching without reload

class Router {
  constructor() {
    this.currentPage = 'home'
    this._bindNav()
  }

  _bindNav() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault()
        try {
          this.navigate(el.dataset.page)
        } catch (err) {
          console.warn('Router: navigation failed for page', el.dataset.page, err)
        }
      })
    })
  }

  navigate(page) {
    try {
      // Hide all pages
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))

      // Show target page
      const target = document.getElementById(`page-${page}`)
      if (target) {
        target.classList.add('active')
        this.currentPage = page
      } else {
        console.warn(`Router: page element #page-${page} not found`)
      }

      // Update nav active state
      document.querySelectorAll('#main-nav a').forEach(a => {
        a.classList.toggle('active', a.dataset.page === page)
      })

      // Scroll to top
      window.scrollTo(0, 0)
    } catch (err) {
      console.warn('Router: navigate() error for page', page, err)
    }
  }
}

const router = new Router()
