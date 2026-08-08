import heroImg from './assets/hero.png'
import './App.css'

function App() {
  return (
    <main className="app">
      <section className="hero">
        <img src={heroImg} className="hero-img" alt="Masahati" />
        <h1>Masahati</h1>
        <p>Frontend scaffold — start building your pages in src/pages.</p>
      </section>
    </main>
  )
}

export default App
