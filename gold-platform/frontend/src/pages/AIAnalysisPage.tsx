import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Brain, Sparkles,
  Send, Bell, BellOff, Loader2, FileText,
  MessageSquare, Zap
} from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { aiApi, pushApi } from '../lib/api'
import { extractApiData } from '../lib/utils'
import { toast } from 'sonner'

interface AnalysisResult {
  content?: string
  title?: string
}

const analysisModules = [
  {
    key: 'bullish',
    title: '看涨分析',
    icon: <TrendingUp size={20} />,
    color: 'green' as const,
    variant: 'primary' as const,
    description: 'AI 分析当前市场的看涨因素与上涨驱动',
  },
  {
    key: 'bearish',
    title: '看空分析',
    icon: <TrendingDown size={20} />,
    color: 'red' as const,
    variant: 'danger' as const,
    description: 'AI 分析当前市场的看空因素与下行风险',
  },
  {
    key: 'summary',
    title: '综合分析',
    icon: <Sparkles size={20} />,
    color: 'cyan' as const,
    variant: 'secondary' as const,
    description: 'AI 综合多空因素，给出全面市场分析',
  },
  {
    key: 'advice',
    title: '投资建议',
    icon: <Brain size={20} />,
    color: 'gold' as const,
    variant: 'gold' as const,
    description: 'AI 基于分析结果给出具体投资操作建议',
  },
]

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let inCodeBlock = false
  let codeContent = ''
  let codeIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${codeIndex++}`} className="bg-dark-900/80 border border-[rgba(0,240,255,0.1)] rounded-lg p-3 my-2 overflow-x-auto">
            <code className="text-xs text-cyan-glow font-mono">{codeContent.trim()}</code>
          </pre>
        )
        codeContent = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += line + '\n'
      continue
    }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-bold text-gold mt-4 mb-2">{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-bold text-cyan-glow mt-4 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold text-[#e0e0ff] mt-4 mb-2">{line.slice(2)}</h1>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-sm text-[#e0e0ff]/90 ml-4 list-disc leading-relaxed">
          {renderInlineMarkdown(line.slice(2))}
        </li>
      )
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-cyan-glow/30 pl-3 my-2 text-sm text-[#8888aa] italic">
          {line.slice(2)}
        </blockquote>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />)
    } else {
      elements.push(<p key={i} className="text-sm text-[#e0e0ff]/90 leading-relaxed">{renderInlineMarkdown(line)}</p>)
    }
  }

  return <div className="space-y-1">{elements}</div>
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-[#e0e0ff] font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="text-cyan-glow/80">{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-dark-700 px-1.5 py-0.5 rounded text-xs text-cyan-glow font-mono">{part.slice(1, -1)}</code>
    }
    return part
  })
}

export default function AIAnalysisPage() {
  const [activeModule, setActiveModule] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)

  // Push config
  const [pushToken, setPushToken] = useState('')
  const [pushType, setPushType] = useState<'daily' | 'alert' | 'all'>('all')
  const [subscribed, setSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const handleAnalysis = async (key: string) => {
    setActiveModule(key)
    setAnalysisResult(null)
    setLoading(true)

    try {
      let res
      switch (key) {
        case 'bullish':
          res = await aiApi.bullishAnalysis()
          break
        case 'bearish':
          res = await aiApi.bearishAnalysis()
          break
        case 'summary':
          res = await aiApi.summaryAnalysis()
          break
        case 'advice':
          res = await aiApi.adviceAnalysis()
          break
        default:
          throw new Error('Unknown analysis module')
      }
      const data = extractApiData(res) as AnalysisResult
      setAnalysisResult(data)
    } catch (err: unknown) {
      const errorData = err instanceof Error ? err.message : '未知错误'
      let errorMessage = 'AI 分析请求失败，请稍后重试'
      let description = ''
      
      try {
        const parsed = JSON.parse(errorData)
        if (parsed.error === '会员等级不足') {
          errorMessage = '会员等级不足'
          description = `当前等级: ${parsed.data?.currentLevel || 'free'}，需要: ${parsed.data?.requiredLevel || 'basic'}\n升级会员以解锁更多 AI 分析功能`
        } else {
          description = parsed.message || parsed.error || ''
        }
      } catch {
        description = errorData
      }
      
      toast.error(errorMessage, { description })
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!pushToken.trim()) {
      toast.error('请输入 PushPlus Token')
      return
    }
    setPushLoading(true)
    try {
      await pushApi.subscribe(pushToken, pushType)
      setSubscribed(true)
      toast.success('订阅成功！将按时推送分析报告')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      toast.error('订阅失败', { description: message })
    } finally {
      setPushLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    setPushLoading(true)
    try {
      await pushApi.unsubscribe()
      setSubscribed(false)
      toast.success('已取消订阅')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      toast.error('取消订阅失败', { description: message })
    } finally {
      setPushLoading(false)
    }
  }

  const handleTestPush = async () => {
    if (!pushToken.trim()) {
      toast.error('请输入 PushPlus Token')
      return
    }
    setPushLoading(true)
    try {
      await pushApi.testPush({ message: '黄金分析平台 - 推送测试' })
      toast.success('测试推送已发送，请检查微信')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      toast.error('测试推送失败', { description: message })
    } finally {
      setPushLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          <HolographicText as="span" color="mixed">AI 分析</HolographicText>报告
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">AI 驱动的黄金市场深度分析与微信推送</p>
      </div>

      {/* Analysis Module Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {analysisModules.map((mod) => (
          <GlowCard
            key={mod.key}
            color={mod.color}
            className={`cursor-pointer ${activeModule === mod.key ? 'ring-1 ring-cyan-glow/50' : ''}`}
            onClick={() => handleAnalysis(mod.key)}
          >
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                mod.color === 'green' ? 'bg-neon-green/10 text-neon-green' :
                mod.color === 'red' ? 'bg-neon-red/10 text-neon-red' :
                mod.color === 'cyan' ? 'bg-cyan-glow/10 text-cyan-glow' :
                'bg-gold/10 text-gold'
              }`}>
                {mod.icon}
              </div>
              <h3 className="text-sm font-semibold text-[#e0e0ff]">{mod.title}</h3>
              <p className="text-[10px] text-[#8888aa] leading-tight">{mod.description}</p>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Analysis Result */}
      {(activeModule || loading) && (
        <GlowCard
          color={analysisModules.find(m => m.key === activeModule)?.color ?? 'cyan'}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e0e0ff] flex items-center gap-2">
              <FileText size={16} className="text-cyan-glow" />
              {analysisModules.find(m => m.key === activeModule)?.title ?? '分析结果'}
            </h3>
            {activeModule && (
              <Badge variant={analysisModules.find(m => m.key === activeModule)?.color ?? 'cyan'}>
                AI Generated
              </Badge>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-cyan-glow/20 border-t-cyan-glow animate-spin" />
                <Brain size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-cyan-glow animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm text-[#e0e0ff] animate-pulse">AI 正在分析中...</p>
                <p className="text-xs text-[#8888aa] mt-1">请稍候，分析可能需要数秒</p>
              </div>
            </div>
          ) : analysisResult ? (
            <div>
              {analysisResult.title && (
                <h4 className="text-lg font-bold text-[#e0e0ff] mb-3">{analysisResult.title}</h4>
              )}
              <MarkdownRenderer content={analysisResult.content || '暂无分析内容'} />
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-[#8888aa]">点击上方模块开始 AI 分析</p>
            </div>
          )}
        </GlowCard>
      )}

      {/* WeChat Push Configuration */}
      <GlowCard color="gold">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#e0e0ff] flex items-center gap-2">
            <Bell size={16} className="text-gold" />
            微信推送配置
          </h3>
          {subscribed && (
            <Badge variant="green" size="md">已订阅</Badge>
          )}
        </div>

        <div className="space-y-4">
          {/* Token Input */}
          <Input
            label="PushPlus Token"
            placeholder="请输入您的 PushPlus Token"
            value={pushToken}
            onChange={(e) => setPushToken(e.target.value)}
            icon={<Send size={14} />}
            type="password"
          />

          {/* Push Type Selection */}
          <div>
            <label className="block text-sm font-medium text-[#8888aa] mb-2">推送类型</label>
            <div className="flex gap-2">
              {[
                { key: 'daily' as const, label: '每日摘要', icon: <FileText size={14} /> },
                { key: 'alert' as const, label: '异动提醒', icon: <Zap size={14} /> },
                { key: 'all' as const, label: '全部', icon: <Bell size={14} /> },
              ].map((type) => (
                <button
                  key={type.key}
                  onClick={() => setPushType(type.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300 border ${
                    pushType === type.key
                      ? 'bg-gold/20 text-gold border-gold/30'
                      : 'bg-dark-800/50 text-[#8888aa] border-[rgba(0,240,255,0.1)] hover:border-gold/20 hover:text-[#e0e0ff]'
                  }`}
                >
                  {type.icon} {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            {!subscribed ? (
              <Button
                variant="gold"
                size="sm"
                onClick={handleSubscribe}
                disabled={pushLoading}
                glow
              >
                {pushLoading ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                订阅推送
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={handleUnsubscribe}
                disabled={pushLoading}
              >
                {pushLoading ? <Loader2 size={14} className="animate-spin" /> : <BellOff size={14} />}
                取消订阅
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestPush}
              disabled={pushLoading || !pushToken.trim()}
            >
              {pushLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              测试推送
            </Button>
          </div>

          {/* Info */}
          <div className="glass-dark rounded-lg p-3">
            <div className="flex items-start gap-2">
              <MessageSquare size={14} className="text-[#8888aa] shrink-0 mt-0.5" />
              <div className="text-xs text-[#8888aa] leading-relaxed">
                <p>PushPlus 是一个免费的微信推送服务。关注 PushPlus 公众号后，在菜单中获取您的 Token。</p>
                <p className="mt-1">• 每日摘要：每天定时推送市场分析报告</p>
                <p>• 异动提醒：金价出现大幅波动时即时推送</p>
                <p>• 全部：同时接收以上两种推送</p>
              </div>
            </div>
          </div>
        </div>
      </GlowCard>
    </div>
  )
}
