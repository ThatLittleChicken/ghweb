import Head from 'next/head'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import AwardList from '../components/AwardList'

function awards() {
    return (
        <div>
            <Head>
                <title>Awards</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <Navbar/>

            <main className='m-5 lg:m-12'>
                <h1 className='text-center text-6xl p-3'>List of Awards</h1>
                <h2 className='text-center text-xl p-4'>Here are awards I've won in school and mostly external competitions <span className='font-bold'>during High School</span> through hardwork and determination.</h2>
                <AwardList/>
            </main>
            <Footer/>
        </div>
    )
}

export default awards
