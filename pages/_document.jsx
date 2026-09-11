import Document, { Html, Head, Main, NextScript } from 'next/document'

// apply the persisted theme before first paint to avoid a flash
const themeInit = `(function(){var t='light';try{var s=localStorage.getItem('theme');if(s==='dark'||s==='light')t=s}catch(e){}document.documentElement.setAttribute('data-theme',t)})()`

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&family=JetBrains+Mono:wght@400;500&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body>
          <script dangerouslySetInnerHTML={{ __html: themeInit }} />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
