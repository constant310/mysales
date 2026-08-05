"use client";

import { motion } from "framer-motion";

interface Props{

title:string

amount:string

className?:string

}

export default function FloatingCard({

title,

amount,

className

}:Props){

return(

<motion.div

animate={{

y:[0,-12,0]

}}

transition={{

duration:4,

repeat:Infinity

}}

className={`rounded-2xl bg-white shadow-2xl p-5 ${className}`}

>

<p className="text-gray-500 text-sm">

{title}

</p>

<h2 className="text-2xl font-bold mt-2">

{amount}

</h2>

</motion.div>

)

}