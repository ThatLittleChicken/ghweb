import 'tailwindcss/tailwind.css'
import firebase from '../config/firebase'
firebase()

  function MyApp({ Component, pageProps }) {
    return <Component {...pageProps} />
  }

  export default MyApp
  

