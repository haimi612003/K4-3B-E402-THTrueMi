import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { ArrowUpRightIcon, ArrowRightIcon } from '@heroicons/react/20/solid'
import classPulseLogo from './assets/class-pulse-logo.svg'
import { Meteors } from './components/Meteors'

const steps = [
  ['01', 'Bắt đầu từ câu hỏi thật.', 'Gõ @ để chọn cụm câu hỏi, hoặc đưa câu hỏi của lớp vào cuộc trò chuyện.'],
  ['02', 'Nhìn thấy điểm chung.', 'Gom những câu hỏi tương đồng thành các chủ đề, kèm số lượng và dẫn chứng gốc.'],
  ['03', 'Chọn điều cần ôn lại.', 'Dùng kết quả để chuẩn bị buổi học tiếp theo. Quyết định cuối cùng vẫn là của bạn.'],
]

export default function LandingPage() {
  const reducedMotion = useReducedMotion()
  const reveal = (delay: number) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: 32 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reducedMotion ? 0 : 1, delay: reducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-[#fafafa] selection:bg-white selection:text-black">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-4 focus:text-black">Đến nội dung chính</a>
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-6 py-7 md:px-12">
        <Link to="/" aria-label="Class Pulse — Trang chủ"><img src={classPulseLogo} alt="Class Pulse" className="h-9 w-auto invert" /></Link>
        <nav aria-label="Điều hướng chính" className="flex items-center gap-8 text-sm">
          <a href="#how-it-works" className="hidden text-neutral-400 transition hover:text-white sm:inline">Cách hoạt động</a>
          <Link to="/app" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-2.5 transition hover:bg-white hover:text-black">Mở ứng dụng <ArrowUpRightIcon className="size-4" aria-hidden="true" /></Link>
        </nav>
      </header>

      <main id="main">
        <section aria-labelledby="hero-title" className="relative isolate mx-auto max-w-7xl overflow-hidden px-6 pt-20 pb-20 text-center md:px-12 md:pt-28">
          <Meteors />
          <motion.p {...reveal(0)} className="mb-8 text-sm leading-relaxed font-medium tracking-[0.24em] text-neutral-400 uppercase md:text-lg"><span className="inline-block motion-safe:shimmer shimmer-color-white shimmer-speed-75">Từ câu hỏi rời rạc đến góc nhìn rõ ràng</span></motion.p>
          <motion.h1 id="hero-title" {...reveal(0.1)} className="mx-auto max-w-4xl text-4xl leading-[1.13] font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Hiểu lớp đang vướng đâu.<br /><span className="text-neutral-500">Biết cần ôn lại điều gì.</span>
          </motion.h1>
          <motion.p {...reveal(0.2)} className="mx-auto mt-7 max-w-lg text-base leading-7 text-neutral-400">Nhanh chóng quyết định điểm cần ôn lại cho lớp của bạn chỉ với <span className="text-white">‘@’</span>. Class Pulse kết nối những câu hỏi thành các chủ đề có dẫn chứng.</motion.p>
          <motion.div {...reveal(0.3)} className="mt-9 flex flex-wrap items-center justify-center gap-5">
            <Link to="/app" className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black transition hover:bg-neutral-200">Khám phá lớp học <ArrowRightIcon className="size-4" aria-hidden="true" /></Link>
            <a href="#how-it-works" className="px-3 py-3 text-sm text-neutral-400 transition hover:text-white">Xem cách hoạt động ↓</a>
          </motion.div>

          <motion.div {...reveal(0.45)} className="mx-auto mt-20 max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#101010] text-left shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-xs text-neutral-500"><span className="flex gap-1.5" aria-hidden="true"><i className="size-2 rounded-full bg-neutral-600" /><i className="size-2 rounded-full bg-neutral-700" /><i className="size-2 rounded-full bg-neutral-800" /></span><span>Góc nhìn lớp học · Minh họa</span><span aria-hidden="true">↗</span></div>
            <div className="grid gap-8 p-6 md:grid-cols-[1fr_1.2fr] md:p-9">
              <div className="flex flex-col justify-center"><p className="text-xs text-neutral-500">BẮT ĐẦU BẰNG MỘT CÂU HỎI</p><p className="mt-4 text-xl leading-relaxed">“Lớp mình cần ôn lại<br />những nội dung nào?”</p><div className="mt-6 flex items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm"><span className="text-neutral-400"><span className="text-white">@</span> Câu hỏi buổi học</span><ArrowUpRightIcon className="size-4" aria-hidden="true" /></div></div>
              <div className="rounded-xl border border-white/10 p-5"><div className="mb-5 flex items-center justify-between"><h2 className="text-sm font-medium">Các chủ đề được nhắc đến</h2><span className="text-[10px] text-neutral-500">DỮ LIỆU VÍ DỤ</span></div>{[['Thiết kế prompt', 80], ['Tool calling', 55], ['Đánh giá kết quả', 35]].map(([label, width]) => <div key={label} className="mb-4"><p className="mb-2 text-xs text-neutral-400">{label}</p><div className="h-1.5 rounded-full bg-white/5"><div className="h-full rounded-full bg-neutral-400" style={{ width: `${width}%` }} /></div></div>)}<p className="mt-5 border-t border-white/10 pt-4 text-xs text-neutral-500">Mỗi chủ đề đi cùng câu hỏi gốc để bạn đối chiếu.</p></div>
            </div>
          </motion.div>
        </section>

        <section id="how-it-works" aria-labelledby="steps-title" className="mx-auto max-w-7xl scroll-mt-10 border-t border-white/10 px-6 py-20 md:px-12 md:py-24">
          <p className="text-xs tracking-[0.2em] text-neutral-500 uppercase">Ít đọc lại. Hiểu nhiều hơn.</p>
          <h2 id="steps-title" className="mt-5 text-3xl font-medium tracking-tight md:text-4xl">Một nhịp rõ ràng cho buổi học tiếp theo.</h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">{steps.map(([number, title, description]) => <article key={number} className="border-t border-white/20 pt-6"><span className="font-mono text-xs text-neutral-500">{number} /</span><h3 className="mt-6 text-xl font-medium">{title}</h3><p className="mt-3 max-w-sm text-sm leading-7 text-neutral-400">{description}</p></article>)}</div>
        </section>
        <section className="border-y border-white/10 px-6 py-20 text-center"><h2 className="text-3xl font-medium tracking-tight md:text-5xl">Lắng nghe lớp. Bắt đầu từ đây.</h2><Link to="/app" className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black transition hover:bg-neutral-200">Mở Class Pulse <ArrowUpRightIcon className="size-4" aria-hidden="true" /></Link></section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-neutral-500 md:px-12"><span>Class Pulse · THTrueMi</span><span>AI gợi ý. Bạn quyết định.</span></footer>
    </div>
  )
}
