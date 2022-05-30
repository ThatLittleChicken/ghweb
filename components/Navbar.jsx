import Link from 'next/link';

function Navbar() {
    return (
        <div>
            <nav className="container flex w-max text-center">
                <ul className="w-auto h-auto flex text-xl p-3 mx-5 m-3 list-none space-x-5 ">
                    <li className="hover:text-red-300 ">
                    <Link href="/">
                        <a>Home</a>
                    </Link>
                    </li>
                    <li className="hover:text-red-300">
                    <Link href="/woah">
                        <a>Woah</a>
                    </Link>
                    </li>
                    <li className="hover:text-red-300">
                    <Link href="/awards">
                        <a>Awards</a>
                    </Link>
                    </li>
                </ul>
            </nav>

        </div>
    )
}

export default Navbar

//navbar is 4.75rem tall