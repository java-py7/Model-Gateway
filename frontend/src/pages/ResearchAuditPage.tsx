import { useState, useEffect } from 'react'
import {
  FileSearch,
  ExternalLink,
  ShieldCheck,
  Code2,
  Cpu,
  Layers,
  BookOpen,
  Terminal,
  CheckCircle,
  FileText,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { api } from '@/services/api'
import type { ResearchItem } from '@/types'

export function ResearchAuditPage() {
  const [technologies, setTechnologies] = useState<ResearchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('all')

  useEffect(() => {
    async function fetchResearch() {
      try {
        setLoading(true)
        const res = await api.getResearchAudit()
        setTechnologies(res.technologies || [])
      } catch (err) {
        console.error('Failed to load research audit data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchResearch()
  }, [])

  const filteredTech =
    activeTab === 'all'
      ? technologies
      : activeTab === 'agents'
        ? technologies.filter(t => ['qwen-code', 'claude-code', 'openai-codex'].includes(t.id))
        : technologies.filter(t => ['llama-cpp', 'ollama', 'llmfit'].includes(t.id))

  const documentationReports = [
    {
      title: 'Repository Audit',
      filename: 'Reports/Repository_Audit.md',
      desc: 'Detailed inspection of all 6 repositories: licenses, security policies, and maintenance status.',
    },
    {
      title: 'Provider Compatibility Matrix',
      filename: 'Reports/Provider_Compatibility_Matrix.md',
      desc: 'Empirical test results, endpoint behaviors, HTTP 429 quota handling, and HTTP 404 observations.',
    },
    {
      title: 'Security Report',
      filename: 'Reports/Security_Report.md',
      desc: 'API key isolation, SSRF prevention, CORS boundaries, untrusted local model execution.',
    },
    {
      title: 'License & Terms Notes',
      filename: 'Reports/License_Terms_Notes.md',
      desc: 'Distinction between repository code licenses, open-weight licenses, and cloud provider API terms.',
    },
    {
      title: 'Free-Tier Model Research',
      filename: 'Reports/Free_Tier_Model_Research.md',
      desc: 'Verified free-tier quotas (Gemini AI Studio 15 RPM), open-weight licenses, and local inference options.',
    },
    {
      title: 'Technical Recommendations',
      filename: 'Reports/Technical_Recommendations.md',
      desc: 'Architectural bridge from Project 1 to Project 2 (Lightweight Engine) and Project 3 (Knowledge Chatbot).',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Research & Technology Audit
            <Badge variant="outline" className="text-[10px]">
              6 Core Technologies Evaluated
            </Badge>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empirical investigation into multi-provider coding agents, local inference engines, and hardware sizing utilities.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs">
              All (6)
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs">
              Coding Agents (3)
            </TabsTrigger>
            <TabsTrigger value="local" className="text-xs">
              Inference & Sizing (3)
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Technologies Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
            Loading verified research audit information…
          </div>
        ) : (
          filteredTech.map(tech => (
            <Card
              key={tech.id}
              className="bg-card/70 border-border shadow-xs flex flex-col justify-between"
            >
              <CardHeader className="pb-3 border-b border-border/60">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground">
                      {tech.name}
                    </CardTitle>
                    <CardDescription className="text-xs text-primary font-medium mt-0.5">
                      {tech.category}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      tech.license.includes('MIT')
                        ? 'success'
                        : tech.license.includes('Apache')
                          ? 'secondary'
                          : 'outline'
                    }
                    className="text-[9px]"
                  >
                    {tech.license_type}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs pt-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Security Policy & Disclosure:
                  </span>
                  <p className="text-[11px] text-foreground leading-relaxed rounded bg-background/50 p-2 border border-border">
                    {tech.security_policy}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                    Key Technical Findings:
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {tech.key_findings}
                  </p>
                </div>

                <div className="space-y-1 border-t border-border/60 pt-2">
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">License:</span>
                    <span className="font-mono font-medium text-foreground">{tech.license}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Maintenance:</span>
                    <span className="text-foreground">{tech.maintenance_status}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-muted-foreground">Dependencies:</span>
                    <span className="text-foreground text-right truncate max-w-[170px]" title={tech.dependencies.join(', ')}>
                      {tech.dependencies.join(', ')}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="border-t border-border/60 pt-3 flex items-center justify-between">
                <a
                  href={tech.repository}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  Official Source / Repo
                  <ExternalLink className="h-3 w-3" />
                </a>

                <Badge variant="outline" className="text-[9px] font-mono">
                  {tech.id}
                </Badge>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      {/* Reports Directory Section */}
      <Card className="bg-card/70 border-border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Comprehensive Markdown Reports Directory
          </CardTitle>
          <CardDescription className="text-xs">
            In-depth documentation, testing observations, and architectural recommendations stored in <code>Reports/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documentationReports.map((report, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-border bg-background/50 space-y-1.5 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    {report.title}
                  </div>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    .md
                  </Badge>
                </div>
                <div className="font-mono text-[10px] text-primary truncate">
                  {report.filename}
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {report.desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Architectural Insights Accordion */}
      <Card className="bg-card/70 border-border shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Key Architectural & Security Insights (Audit Synthesis)
          </CardTitle>
          <CardDescription className="text-xs">
            Core legal, threat mitigation, and infrastructure findings synthesized across audited projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <Accordion type="single" collapsible className="w-full text-xs">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-xs font-semibold text-foreground">
                1. Separation of Repository Code Licenses from Model Weight Checkpoints
              </AccordionTrigger>
              <AccordionContent className="text-[11px] text-muted-foreground leading-relaxed">
                A permissive software license (such as MIT in llama.cpp or Apache 2.0 in Qwen Code) applies strictly to the source code of the runtime or client harness. It does NOT automatically grant unrestricted commercial rights to downloaded neural network weights. For instance, Meta's Llama 3.2 family is bound by the Llama 3.2 Community License (capping free commercial use at 700M monthly active users), and Alibaba's Qwen 72B uses a distinct commercial agreement.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-xs font-semibold text-foreground">
                2. Mandatory Loopback Isolation for Local Inference Daemons
              </AccordionTrigger>
              <AccordionContent className="text-[11px] text-muted-foreground leading-relaxed">
                Both Ollama (port 11434) and llama-server (port 8080) do not implement native authentication mechanisms out of the box. Binding these ports to public network interfaces (0.0.0.0) allows arbitrary external parties on the local network or internet to execute models, consume GPU memory, or trigger Denial of Service. In Model Gateway, all local routes strictly target loopback interfaces (127.0.0.1).
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-xs font-semibold text-foreground">
                3. Role of llmfit as a Sizing Advisor vs Inference Server
              </AccordionTrigger>
              <AccordionContent className="text-[11px] text-muted-foreground leading-relaxed">
                Our repository audit of AlexsJones/llmfit confirmed that llmfit is a hardware-recommendation utility designed to estimate memory fit before downloading weights. It does not perform inference. Model Gateway embeds these exact sizing formulas natively into main.py (/api/estimator/calculate), while detecting whether the llmfit CLI is present on PATH.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  )
}

