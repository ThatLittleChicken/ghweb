import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
    static async getInitialProps(ctx) {
        const initialProps = await Document.getInitialProps(ctx)
        return { ...initialProps }
      }

  render() {
    return (
      <Html>
        <Head>
          <link
            href="https://fonts.googleapis.com/css?family=Product+Sans:100,300,400,500,700,900,100i,300i,400i,500i,700i,900i&display=swap"
            rel="stylesheet"
          />
          <link rel="stylesheet" href="https://unpkg.com/aos@next/dist/aos.css" />
        </Head>
        <body>
          <Main />
          <NextScript />
          <script src="https://unpkg.com/aos@next/dist/aos.js"></script>
          <script>
            AOS.init();
          </script>
        </body>
      </Html>
    )
  }
}

export default MyDocument