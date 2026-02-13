import './loader.css'

export default function Loader() {
  return (
    <div className="loader">
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0s' }}>.</span>
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0.2s' }}>.</span>
      <span style={{ animation: 'wave 1.4s infinite', animationDelay: '0.4s' }}>.</span>
    </div>
  )
}