import { useState } from 'react'
import { TrendingUp, TrendingDown, Brain, RefreshCw, Lock, Sparkles } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { useGoldData } from '../contexts/GoldDataContext'
import { useAuth, MembershipGate } from '../lib/auth'
import { getImpactBgColor } from '../lib/utils'
import { goldApi } from '../lib/api'

export default function Analysis() {
  const { analysis, loading, refreshAnalysis } = useGoldData()
  const { user } = useAuth()
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const handleAiAnalyze = async () => {
    if (!aiQuestion.trim()) return
    setAiLoading(true)
    setAiAnswer('')
    try {
      const res = await goldApi.analyze({ question: aiQuestion })
      setAiAnswer(res.data?.analysis || res.data?.answer || JSON.stringify(res.data))
    } catch {
      setAiAnswer('分析请求失败，请稍后重试')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading && !analysis) {
    return <Loading text="加载分析数据..." />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            AI <HolographicText color="cyan">智能分析</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">多维度因子分析与AI深度解读</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAnalysis}>
          <RefreshCw size={14} /> 刷新分析
        </Button>
      </div>

      {/* AI Analysis Section */}
      <GlowCard color="cyan" className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-glow to-transparent" />
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-cyan-glow/10 flex items-center justify-center animate-glow-pulse">
            <Brain size={20} className="text-cyan-glow" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#e0e0ff]">AI 分析助手</h3>
            <p className="text-xs text-[#8888aa]">输入您的问题，AI 将为您深度解读市场</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiAnalyze()}
            placeholder="例如：当前黄金市场的主要驱动因素是什么？"
            className="flex-1 bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#e0e0ff] placeholder-[#8888aa]/50 focus:outline-none focus:border-cyan-glow/50 focus:ring-1 focus:ring-cyan-glow/30 transition-all"
          />
          <Button variant="primary" glow onClick={handleAiAnalyze} disabled={aiLoading}>
            {aiLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-glow/20 border-t-cyan-glow" />
            ) : (
              <><Sparkles size={14} /> 分析</>
            )}
          </Button>
        </div>
        {aiAnswer && (
          <div className="mt-4 p-4 bg-dark-800/50 rounded-lg border border-[rgba(0,240,255,0.1)]">
            <p className="text-sm text-[#e0e0ff] leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
          </div>
        )}
      </GlowCard>

      {/* Factor Tabs */}
      <Tabs.Root defaultValue="bullish">
        <Tabs.List className="flex gap-1 bg-dark-800/50 p-1 rounded-lg border border-[rgba(0,240,255,0.1)] mb-6">
          <Tabs.Trigger
            value="bullish"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-md transition-all data-[state=active]:bg-neon-green/10 data-[state=active]:text-neon-green data-[state=active]:border data-[state=active]:border-neon-green/20 text-[#8888aa] hover:text-[#e0e0ff]"
          >
            <TrendingUp size={16} /> 看涨因子
          </Tabs.Trigger>
          <Tabs.Trigger
            value="bearish"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-md transition-all data-[state=active]:bg-neon-red/10 data-[state=active]:text-neon-red data-[state=active]:border data-[state=active]:border-neon-red/20 text-[#8888aa] hover:text-[#e0e0ff]"
          >
            <TrendingDown size={16} /> 看跌因子
          </Tabs.Trigger>
          <Tabs.Trigger
            value="summary"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-md transition-all data-[state=active]:bg-cyan-glow/10 data-[state=active]:text-cyan-glow data-[state=active]:border data-[state=active]:border-cyan-glow/20 text-[#8888aa] hover:text-[#e0e0ff]"
          >
            <Brain size={16} /> 市场总结
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="bullish">
          <MembershipGate level="basic" fallback={
            <GlowCard color="cyan">
              <div className="text-center py-8">
                <Lock size={40} className="mx-auto text-[#8888aa] mb-3" />
                <h3 className="text-lg font-semibold text-[#e0e0ff] mb-2">看涨因子分析</h3>
                <p className="text-sm text-[#8888aa] mb-4">升级到基础会员即可查看详细看涨因子</p>
                <Badge variant="gold">需要 Basic 会员</Badge>
              </div>
            </GlowCard>
          }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(analysis?.bullishFactors || defaultBullishFactors).map((factor, index) => (
                <GlowCard key={factor.id || index} color="green">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-[#e0e0ff]">{factor.title}</h4>
                    <Badge className={getImpactBgColor(factor.impact)} size="sm">
                      {factor.impact === 'high' ? '高影响' : factor.impact === 'medium' ? '中影响' : '低影响'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8888aa] leading-relaxed">{factor.description}</p>
                  {factor.category && (
                    <div className="mt-2">
                      <Badge variant="green" size="sm">{factor.category}</Badge>
                    </div>
                  )}
                </GlowCard>
              ))}
            </div>
          </MembershipGate>
        </Tabs.Content>

        <Tabs.Content value="bearish">
          <MembershipGate level="basic" fallback={
            <GlowCard color="cyan">
              <div className="text-center py-8">
                <Lock size={40} className="mx-auto text-[#8888aa] mb-3" />
                <h3 className="text-lg font-semibold text-[#e0e0ff] mb-2">看跌因子分析</h3>
                <p className="text-sm text-[#8888aa] mb-4">升级到基础会员即可查看详细看跌因子</p>
                <Badge variant="gold">需要 Basic 会员</Badge>
              </div>
            </GlowCard>
          }>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(analysis?.bearishFactors || defaultBearishFactors).map((factor, index) => (
                <GlowCard key={factor.id || index} color="red">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-[#e0e0ff]">{factor.title}</h4>
                    <Badge className={getImpactBgColor(factor.impact)} size="sm">
                      {factor.impact === 'high' ? '高影响' : factor.impact === 'medium' ? '中影响' : '低影响'}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#8888aa] leading-relaxed">{factor.description}</p>
                  {factor.category && (
                    <div className="mt-2">
                      <Badge variant="red" size="sm">{factor.category}</Badge>
                    </div>
                  )}
                </GlowCard>
              ))}
            </div>
          </MembershipGate>
        </Tabs.Content>

        <Tabs.Content value="summary">
          <GlowCard color="cyan">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-cyan-glow" />
              <h3 className="text-lg font-semibold text-[#e0e0ff]">AI 市场总结</h3>
            </div>
            <p className="text-sm text-[#e0e0ff] leading-relaxed whitespace-pre-wrap">
              {analysis?.marketSummary || '当前黄金市场整体呈现震荡上行趋势。美联储降息预期持续支撑金价，地缘政治风险为黄金提供避险需求。技术面上，金价在关键支撑位企稳，短期有望继续上探。建议投资者关注美国经济数据及美联储政策动向，合理控制仓位。'}
            </p>
          </GlowCard>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

const defaultBullishFactors = [
  { id: '1', title: '美联储降息预期', description: '市场普遍预期美联储将在未来数月内启动降息周期，实际利率下行将直接利好黄金', impact: 'high', category: '货币政策' },
  { id: '2', title: '地缘政治风险上升', description: '中东局势持续紧张，俄乌冲突未见缓和，避险需求推升金价', impact: 'high', category: '地缘政治' },
  { id: '3', title: '全球央行持续购金', description: '中国、印度等新兴市场央行持续增持黄金储备，为金价提供长期支撑', impact: 'medium', category: '供需面' },
  { id: '4', title: '美元指数走弱', description: '美元指数从高位回落，以美元计价的黄金获得支撑', impact: 'medium', category: '汇率' },
]

const defaultBearishFactors = [
  { id: '1', title: '美国经济数据强劲', description: '近期非农就业等数据好于预期，可能推迟美联储降息时间表', impact: 'high', category: '经济数据' },
  { id: '2', title: '技术面超买风险', description: 'RSI指标接近超买区域，短期存在技术性回调可能', impact: 'medium', category: '技术面' },
  { id: '3', title: '获利了结压力', description: '金价连续上涨后，部分投资者选择获利了结', impact: 'low', category: '市场情绪' },
]
