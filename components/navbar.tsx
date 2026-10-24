"use client"
import Link from "next/link"
export default function Navbar(){
    
    return(
        <div className="flex bg-indigo-500 justify-center gap-1.5 h-10 ">
<li className="flex justify-between gap-2">
<ul className="flex text-center rounded-lg px-4 py-2 bg-indigo-300 text-white">
   <Link href='/upload'> Upload</Link> 
</ul>
<ul className="flex text-center rounded-lg px-4 py-2 bg-indigo-300 text-white">
    Upload1
</ul>
<ul className="flex text-center rounded-lg px-4 py-2 bg-indigo-300 text-white">
    Upload2
</ul>
<ul className="flex text-center rounded-lg px-4 py-2 bg-indigo-300 text-white">
    Upload3
</ul>
</li>
        </div>
    )
}