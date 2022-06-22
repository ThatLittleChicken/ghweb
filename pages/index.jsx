import Head from 'next/head'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import Ag from '../components/Ag'
import Hello from '../components/Hello'
import Link from 'next/link'
import * as React from 'react';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Head>
        <title>Hello!</title>
        <link rel="icon" href="./favicon.ico" />
        {/* <meta name="viewport" content="initial-scale=1, width=device-width" /> */}
        <meta charset="UTF-8"/>
        <meta name="description" content="Hello there, this is just a simple about me!"/>
        <meta name="keywords" content='Gent, Gent Hoong, Yong Gent Hoong'></meta>
      </Head>

      <Navbar/>
      <main className="">
        <div className="flex flex-col items-center justify-center h-[75vh]">
          <Hello/>
        </div>
        
        
      </main>
      <Footer/>
    </div>
  )
}
