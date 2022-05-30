const awards = {
    "2021": [
        {
            year: '2021',
            comp: 'Malaysian Computing Challenge',
            title: 'Gold Award',
            link: 'https://ioimalaysia.org/competition/mcc/2021/'
        },
        {
            year: '2021',
            comp: 'INTI e-workshop EDA Circuit Design',
            title: '3rd Prize',
            link: ''
        },
        {
            year: '2021',
            comp: 'INTI e-workshop Programming Maze Challenge',
            title: '1st Prize',
            link: ''
        }
    ],
    "2020":[
        {
            year: '2020',
            comp: 'International Astronomy and Astrophysics Competition',
            title: 'Finalist, Bronze Award',
            link: 'https://iaac.space/en/'
        },{
            year: '2020',
            comp: 'CEC Young Engineers 100 Day Makerthon',
            title: 'Silver Award, Best Advertisment',
            link: ''
        },{
            year: '2020',
            comp: 'English Online Interclass Debate 2020',
            title: '2nd Prize',
            link: ''
        }
    ],
    "2019":[
        {
            year: '2019',
            comp: 'The First International Youth UAV Science Camp and Competition',
            title: '1st Prize',
            link: 'https://english.www.gov.cn/news/photos/201907/22/content_WS5d35515bc6d00d362f668a27.html'
        },{
            year: '2019',
            comp: 'IET Faraday Challenge Malaysia',
            title: '2nd Prize',
            link: 'https://www.ietfaradaymalaysia.com/'
        },{
            year: '2019',
            comp: 'IET Faraday Challenge Penang',
            title: '2nd Prize',
            link: 'https://www.ietfaradaymalaysia.com/'
        },{
            year: '2019',
            comp: 'UBTECH Robotics Competition Smart Factory',
            title: '2nd Prize',
            link: ''
        },{
            year: '2019',
            comp: 'State Award for Excellence in Extra Curricular Actvites',
            title: 'Gold Award',
            link: ''
        },{
            year: '2019',
            comp: 'STEAM Science Fair',
            title: 'Merit Prize',
            link: ''
        },{
            year: '2019',
            comp: 'School\'s Club Performance Award',
            title: 'Gold Award',
            link: ''
        },{
            year: '2019',
            comp: 'School\'s Club Performance Report',
            title: 'Best Slides Design',
            link: ''
        }
    ],
    "2017":[
        {
            year: '2017',
            comp: 'MISCC Robotic Workshop and Competition 2017',
            title: 'Excellence Award',
            link: ''
        },{
            year: '2017',
            comp: 'Choral Speaking Competition',
            title: 'Excellence Award',
            link: ''
        },{
            year: '2017',
            comp: '13th Annual Interclass Performing Arts Competition',
            title: 'Silver Award',
            link: ''
        }
    ],
    "2016":[
        {
            year: '2016',
            comp: 'The Second ASEAN Student Science Project Competiton (ASPC 2016)',
            title: '1st Prize',
            link: 'https://www.nsm.or.th/nsm/en/node/8039'
        },{
            year: '2016',
            comp: 'ACCCIM STI Competition',
            title: '1st Prize',
            link: 'https://www.enanyang.my/%E6%97%B6%E4%BA%8B/%E4%B8%AD%E5%AD%A6%E7%A7%91%E6%8A%80%E5%88%9B%E6%96%B0%E8%B5%9B-%E9%92%9F%E7%81%B5%E7%8B%AC%E4%B8%AD%E9%81%A5%E6%8E%A7%E7%B3%BB%E7%BB%9F%E5%A4%BA%E5%86%A0'
        },{
            year: '2016',
            comp: 'Tan Kah Kee Young Inventors 2016',
            title: 'Overall Champion',
            link: 'https://www.newera.edu.my/competition/tkkyiam/en/index.php'
        },{
            year: '2016',
            comp: '12th Annual Interclass Performing Arts Competition',
            title: 'Silver Award',
            link: ''
        },{
            year: '2016',
            comp: 'Annual Hill Cimbing Competition',
            title: '20th Place',
            link: ''
        }
    ]
};

const years = Object.keys(awards);

function AwardList() {
    return (
        <div >
            <div className="mx-3 m-3 lg:m-12 lg:mx-44">
            {
                years.map((year) => 
                    <>
                        <p className="py-3 text-5xl text-blue-600">{year}</p>
                            <ul className="list-disc text-2xl px-4 lg:px-[7.5rem] p-3" data-aos="fade-up" data-aos-anchor-placement="top-bottom">
                                {awards[year].map((award) => 
                                    (award.link !== '') ? 
                                    <><li><a href={award.link} className='hover:text-blue-600 cursor-pointer'>{award.comp}</a></li><p className="text-xl"> - {award.title}</p></> :
                                    <><li>{award.comp}</li><p className="text-xl"> - {award.title}</p></>
                                )}
                            </ul>
                    </>
                )
            }
            </div>
        </div>
    )
}

export default AwardList