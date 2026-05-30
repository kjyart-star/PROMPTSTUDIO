'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ArrowLeft, Plus } from 'lucide-react'

interface PricingClientProps {
  user: any
}

export function PricingClient({ user }: PricingClientProps) {
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(false)
  const [userCredits, setUserCredits] = useState<number>(120)
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [transactions, setTransactions] = useState<any[]>([])
  const [uiLanguage, setUiLanguage] = useState<string>('KO')
  
  // Load current subscription states from localStorage
  useEffect(() => {
    const savedPlan = localStorage.getItem('user-plan')
    if (savedPlan) {
      setCurrentPlan(savedPlan)
    } else {
      localStorage.setItem('user-plan', 'free')
    }

    const savedCredits = localStorage.getItem('user-credits')
    if (savedCredits !== null) {
      setUserCredits(parseFloat(savedCredits))
    } else {
      localStorage.setItem('user-credits', '120')
    }

    const savedTx = localStorage.getItem('user-transactions')
    if (savedTx) {
      try {
        setTransactions(JSON.parse(savedTx))
      } catch (e) {
        console.error(e)
      }
    }

    const savedLang = localStorage.getItem('uiLanguage')
    if (savedLang) {
      setUiLanguage(savedLang)
    }
  }, [])

  const handleSubscribe = (plan: 'pro' | 'premier' | 'payg_30' | 'payg_60') => {
    if (!user) {
      router.push('/login')
      return
    }

    let planCredits = 0
    let planName = ''
    if (plan === 'pro') { planCredits = 2500; planName = 'Pro Plan' }
    else if (plan === 'premier') { planCredits = 10000; planName = 'Premier Plan' }
    else if (plan === 'payg_30') { planCredits = 6800; planName = 'Pay-As-You-Go ($30)' }
    else if (plan === 'payg_60') { planCredits = 14300; planName = 'Pay-As-You-Go ($60)' }

    const newCredits = planCredits

    localStorage.setItem('user-plan', plan)
    localStorage.setItem('user-credits', String(newCredits))
    localStorage.setItem('user-plan-billing', isAnnual ? 'yearly' : 'monthly')
    
    // Calculate renewal date
    const now = new Date()
    const renewalDate = new Date(now.setMonth(now.getMonth() + 1))
    const renewalStr = `${renewalDate.getFullYear()}-${String(renewalDate.getMonth() + 1).padStart(2, '0')}-${String(renewalDate.getDate()).padStart(2, '0')}`
    localStorage.setItem('user-plan-renewal', renewalStr)

    // Add transaction log
    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    const newTx = {
      id: `tx-${Date.now()}`,
      date: dateStr,
      type: 'charge',
      desc: `Subscribed to ${planName} (${isAnnual ? 'Billed Annually' : 'Billed Monthly'})`,
      amount: `+${planCredits}`,
      status: 'Completed'
    }
    const nextTx = [newTx, ...transactions]
    localStorage.setItem('user-transactions', JSON.stringify(nextTx))

    // Redirect to settings credits page
    router.push('/settings?section=credits')
  }

  const handleBuyExtraCredits = (amount: number) => {
    if (!user) {
      router.push('/login')
      return
    }

    const nextCredits = userCredits + amount
    localStorage.setItem('user-credits', String(nextCredits))

    const dateStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')} ${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    const prices: Record<number, string> = {
      500: '$8.00',
      1000: '$16.00',
      2000: '$32.00'
    }
    const priceStr = prices[amount] || 'N/A'
    const newTx = {
      id: `tx-${Date.now()}`,
      date: dateStr,
      type: 'charge',
      desc: `Purchased Extra Credits (+${amount}) - ${priceStr}`,
      amount: `+${amount}`,
      status: 'Completed'
    }
    const nextTx = [newTx, ...transactions]
    localStorage.setItem('user-transactions', JSON.stringify(nextTx))

    router.push('/settings?section=credits')
  }

  const proFeatures = [
    '최고 수준의 개인 맞춤형 5 버전 모델에 액세스하세요.',
    '2,500 크레딧(최대 500곡), 매월 갱신',
    '새로 제작된 노래에 대한 상업적 이용 권한',
    '스탠다드 기능 + 프로 기능',
    '기존 곡에 새로운 보컬이나 악기 연주를 추가하세요',
    '새로운 기능에 대한 조기 액세스',
    '추가 크레딧 구매 기능',
    '우선 재생 대기열, 최대 6곡 동시 생성'
  ]

  const premierFeatures = [
    'Beatz Studio 이용 안내',
    '최고 수준의 개인 맞춤형 5 버전 모델에 액세스하세요.',
    '10,000 크레딧(최대 2,000곡), 매월 갱신',
    '새로 제작된 노래에 대한 상업적 이용 권한',
    '스탠다드 기능 + 프로 기능',
    '기존 곡에 새로운 보컬이나 악기 연주를 추가하세요',
    '새로운 기능에 대한 조기 액세스',
    '추가 크레딧 구매 기능',
    '우선 재생 대기열, 최대 6곡 동시 생성'
  ]

  const payAsYouGoFeatures = [
    '30달러부터 자유롭게 결제',
    '결제일로부터 6개월간 크레딧 유효',
    '사용한 만큼만 크레딧 소모',
    '일반 구독 대비 약 10% 할증',
    '최고 수준의 개인 맞춤형 5 버전 모델에 액세스',
    '상업적 이용 권한 포함',
    '스탠다드 기능 + 프로 기능'
  ]

  const payAsYouGo60Features = [
    '60달러 대용량 종량제',
    '결제일로부터 6개월간 크레딧 유효',
    '사용한 만큼만 크레딧 소모',
    '기본 종량제 대비 약 5% 추가 할인',
    '최고 수준의 개인 맞춤형 5 버전 모델에 액세스',
    '상업적 이용 권한 포함',
    '스탠다드 기능 + 프로 기능'
  ]

  return (
    <div className="min-h-screen bg-background text-white py-12 px-6 sm:px-12 md:px-24">
      {/* Back to Profile */}
      <button 
        onClick={() => router.back()} 
        className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors mb-8 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> 뒤로 가기
      </button>

      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3 bg-clip-text text-white">
          Beatz 요금제를 관리하세요
        </h1>
        <p className="text-sm md:text-base text-zinc-400 font-medium">
          본인의 필요에 가장 적합한 요금제를 선택하세요.
        </p>
      </div>

      {user && (
        <div className="max-w-md mx-auto mb-12 bg-[#121214] border border-zinc-800 rounded-2xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {uiLanguage === 'KO' ? '현재 요금제' : 'Current Plan'}
            </span>
            <span className="text-sm font-black text-primary capitalize">
              {currentPlan === 'free' ? (uiLanguage === 'KO' ? '무료 플랜' : 'Free Plan') : 
               currentPlan === 'pro' ? (uiLanguage === 'KO' ? '프로 플랜' : 'Pro Plan') : 
               (uiLanguage === 'KO' ? '프리미어 플랜' : 'Premier Plan')}
            </span>
          </div>
          <div className="h-8 w-[1px] bg-zinc-800"></div>
          <div className="flex flex-col text-right">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {uiLanguage === 'KO' ? '현재 보유 크레딧' : 'Available Credits'}
            </span>
            <span className="text-sm font-black text-white">
              {userCredits.toLocaleString()} {uiLanguage === 'KO' ? '크레딧' : 'Credits'}
            </span>
          </div>
        </div>
      )}

      {/* Monthly / Annual Toggle */}
      <div className="flex items-center justify-center gap-4 mb-16">
        <span className={`text-sm font-bold transition-all ${!isAnnual ? 'text-white' : 'text-zinc-500'}`}>월간 간행물</span>
        <button 
          onClick={() => setIsAnnual(!isAnnual)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAnnual ? 'bg-primary animate-none' : 'bg-zinc-800'}`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAnnual ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
        <span className={`text-sm font-bold transition-all ${isAnnual ? 'text-primary' : 'text-zinc-500'} flex items-center gap-1.5`}>
          연간
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-primary text-black">20% 할인</span>
        </span>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-20 px-4 xl:px-0">
        {/* Pro Plan Card */}
        <div className="relative rounded-3xl bg-[#121214] border border-zinc-800 p-8 flex flex-col justify-between hover:border-zinc-700/80 transition-all hover:scale-[1.01] shadow-2xl overflow-hidden group">
          {/* Top highlight */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-pink-500 to-rose-500"></div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">프로 플랜</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-pink-500/10 border border-pink-500/35 text-pink-400 uppercase tracking-wide">
                가장 인기 있는
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 font-medium mb-6">
              최고의 모델과 편집 도구를 이용할 수 있습니다.
            </p>

            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-white tracking-tight">
                {isAnnual ? '8달러' : '10달러'}
              </span>
              <span className="text-xs font-bold text-zinc-400">/월</span>
              {isAnnual && (
                <span className="text-[10px] font-semibold text-zinc-500 block ml-2">연간 결제시 할인적용 (세금 별도)</span>
              )}
            </div>

            <button 
              onClick={() => handleSubscribe('pro')}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                currentPlan === 'pro' 
                  ? 'bg-zinc-800 text-zinc-500 cursor-default border border-zinc-700' 
                  : 'bg-white hover:bg-zinc-100 text-black hover:shadow-lg'
              }`}
              disabled={currentPlan === 'pro'}
            >
              {currentPlan === 'pro' 
                ? (uiLanguage === 'KO' ? '현재 구독 중 (2,500 크레딧)' : 'Current Plan (2,500 Credits)') 
                : (uiLanguage === 'KO' ? '구독하기 (2,500 크레딧 충전)' : 'Subscribe (+2,500 Credits)')}
            </button>

            <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-col gap-3">
              {proFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-left">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Premier Plan Card */}
        <div className="relative rounded-3xl bg-[#121214] border border-zinc-800 p-8 flex flex-col justify-between hover:border-zinc-700/80 transition-all hover:scale-[1.01] shadow-2xl overflow-hidden group">
          {/* Top highlight */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary to-[#49be67]"></div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">프리미어 플랜</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-primary/10 border border-primary/35 text-primary uppercase tracking-wide">
                최고의 가성비
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 font-medium mb-6">
              최대 크레딧과 모든 기능 잠금 해제.
            </p>

            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-white tracking-tight">
                {isAnnual ? '24달러' : '30달러'}
              </span>
              <span className="text-xs font-bold text-zinc-400">/월</span>
              {isAnnual && (
                <span className="text-[10px] font-semibold text-zinc-500 block ml-2">연간 결제시 할인적용 (세금 별도)</span>
              )}
            </div>

            <button 
              onClick={() => handleSubscribe('premier')}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                currentPlan === 'premier' 
                  ? 'bg-zinc-800 text-zinc-500 cursor-default border border-zinc-700' 
                  : 'bg-primary hover:bg-primary/95 text-black hover:shadow-lg'
              }`}
              disabled={currentPlan === 'premier'}
            >
              {currentPlan === 'premier' 
                ? (uiLanguage === 'KO' ? '현재 구독 중 (10,000 크레딧)' : 'Current Plan (10,000 Credits)') 
                : (uiLanguage === 'KO' ? '구독하기 (10,000 크레딧 충전)' : 'Subscribe (+10,000 Credits)')}
            </button>

            <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-col gap-3">
              {premierFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-left">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pay-As-You-Go (종량제) Card */}
        <div className="relative rounded-3xl bg-[#121214] border border-zinc-800 p-8 flex flex-col justify-between hover:border-zinc-700/80 transition-all hover:scale-[1.01] shadow-2xl overflow-hidden group">
          {/* Top highlight */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-cyan-400"></div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">종량제 크레딧</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 border border-blue-500/35 text-blue-400 uppercase tracking-wide">
                쓴 만큼만 소모
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 font-medium mb-6">
              정기결제 없이 필요한 만큼만 구매해 사용하세요. (6개월 유효)
            </p>

            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-white tracking-tight">
                30달러
              </span>
              <span className="text-xs font-bold text-zinc-400">부터</span>
            </div>

            <button 
              onClick={() => handleSubscribe('payg_30')}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                currentPlan === 'payg_30' 
                  ? 'bg-zinc-800 text-zinc-500 cursor-default border border-zinc-700' 
                  : 'bg-white/10 hover:bg-white/20 text-white hover:shadow-lg border border-white/20'
              }`}
              disabled={currentPlan === 'payg_30'}
            >
              {currentPlan === 'payg_30' 
                ? (uiLanguage === 'KO' ? '현재 구독 중' : 'Current Plan') 
                : (uiLanguage === 'KO' ? '충전하기 (6,800 크레딧)' : 'Recharge (6,800 Credits)')}
            </button>

            <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-col gap-3">
              {payAsYouGoFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-left">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pay-As-You-Go ($60) Card */}
        <div className="relative rounded-3xl bg-[#121214] border border-zinc-800 p-8 flex flex-col justify-between hover:border-zinc-700/80 transition-all hover:scale-[1.01] shadow-2xl overflow-hidden group">
          {/* Top highlight */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-indigo-400"></div>
          
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold text-white">종량제 대용량</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 border border-purple-500/35 text-purple-400 uppercase tracking-wide">
                5% 추가 할인
              </span>
            </div>
            
            <p className="text-xs text-zinc-400 font-medium mb-6">
              더 많은 크레딧을 합리적인 가격에 구매해 사용하세요. (6개월 유효)
            </p>

            <div className="flex items-baseline gap-1 mb-8">
              <span className="text-4xl font-black text-white tracking-tight">
                60달러
              </span>
            </div>

            <button 
              onClick={() => handleSubscribe('payg_60')}
              className={`w-full py-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                currentPlan === 'payg_60' 
                  ? 'bg-zinc-800 text-zinc-500 cursor-default border border-zinc-700' 
                  : 'bg-white/10 hover:bg-white/20 text-white hover:shadow-lg border border-white/20'
              }`}
              disabled={currentPlan === 'payg_60'}
            >
              {currentPlan === 'payg_60' 
                ? (uiLanguage === 'KO' ? '현재 구독 중' : 'Current Plan') 
                : (uiLanguage === 'KO' ? '충전하기 (14,300 크레딧)' : 'Recharge (14,300 Credits)')}
            </button>

            <div className="mt-8 pt-8 border-t border-zinc-800 flex flex-col gap-3">
              {payAsYouGo60Features.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-300 font-medium">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span className="leading-relaxed text-left">{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Extra Credits Recharge Section */}
      <div className="max-w-5xl mx-auto border-t border-zinc-800 pt-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-extrabold tracking-tight mb-2">추가 크레딧 충전</h2>
          <p className="text-xs text-zinc-400">구독 중인 상태에서 추가 크레딧을 개별적으로 충전할 수 있습니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all flex flex-col justify-between text-center relative overflow-hidden group shadow-lg">
            <div className="flex flex-col gap-1.5 items-center">
              <Plus className="w-5 h-5 text-primary" />
              <span className="text-lg font-black text-white">500 Credits</span>
              <span className="text-[10px] text-zinc-400">약 100곡 생성 가능</span>
            </div>
            <div className="mt-6">
              <div className="text-[10px] text-zinc-500 font-semibold space-y-1 mb-3">
                <div className="flex justify-between px-1">
                  <span>원가 (Cost):</span>
                  <span>$5.00</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>마진 (Margin):</span>
                  <span className="text-primary">60%</span>
                </div>
              </div>
              <span className="block text-2xl font-black text-white mb-4">$8.00</span>
              <button 
                onClick={() => handleBuyExtraCredits(500)}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs transition-all cursor-pointer"
              >
                {uiLanguage === 'KO' ? '500 크레딧 충전하기' : 'Recharge 500 Credits'}
              </button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-[#121214] border border-primary/20 rounded-2xl p-6 hover:border-zinc-800 transition-all flex flex-col justify-between text-center relative overflow-hidden group shadow-lg">
            <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-lg text-[8px] font-black bg-primary text-black uppercase tracking-wider">
              Best
            </div>
            <div className="flex flex-col gap-1.5 items-center">
              <Plus className="w-5 h-5 text-primary" />
              <span className="text-lg font-black text-white">1,000 Credits</span>
              <span className="text-[10px] text-zinc-400">약 200곡 생성 가능</span>
            </div>
            <div className="mt-6">
              <div className="text-[10px] text-zinc-500 font-semibold space-y-1 mb-3">
                <div className="flex justify-between px-1">
                  <span>원가 (Cost):</span>
                  <span>$10.00</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>마진 (Margin):</span>
                  <span className="text-primary">60%</span>
                </div>
              </div>
              <span className="block text-2xl font-black text-white mb-4">$16.00</span>
              <button 
                onClick={() => handleBuyExtraCredits(1000)}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-black font-extrabold text-xs transition-all cursor-pointer"
              >
                {uiLanguage === 'KO' ? '1,000 크레딧 충전하기' : 'Recharge 1,000 Credits'}
              </button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-[#121214] border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-all flex flex-col justify-between text-center relative overflow-hidden group shadow-lg">
            <div className="flex flex-col gap-1.5 items-center">
              <Plus className="w-5 h-5 text-primary" />
              <span className="text-lg font-black text-white">2,000 Credits</span>
              <span className="text-[10px] text-zinc-400">약 400곡 생성 가능</span>
            </div>
            <div className="mt-6">
              <div className="text-[10px] text-zinc-500 font-semibold space-y-1 mb-3">
                <div className="flex justify-between px-1">
                  <span>원가 (Cost):</span>
                  <span>$20.00</span>
                </div>
                <div className="flex justify-between px-1">
                  <span>마진 (Margin):</span>
                  <span className="text-primary">60%</span>
                </div>
              </div>
              <span className="block text-2xl font-black text-white mb-4">$32.00</span>
              <button 
                onClick={() => handleBuyExtraCredits(2000)}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs transition-all cursor-pointer"
              >
                {uiLanguage === 'KO' ? '2,000 크레딧 충전하기' : 'Recharge 2,000 Credits'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
