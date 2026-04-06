import OpenAI from "openai";

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'thought';
  content: string;
}

export class SimpleAgent {
  private openai: OpenAI | null = null;
  private model: string = "qwen-turbo"; // 或者 qwen-plus, qwen-max
  private systemPrompt: string;

  constructor(apiKey?: string, systemPrompt?: string) {
    this.systemPrompt = systemPrompt || "你是一个由 React 和通义千问驱动的高效 AI 助手。";
    const key = apiKey || import.meta.env.VITE_DASHSCOPE_API_KEY;
    if (key && key !== 'your_api_key_here') {
      this.openai = new OpenAI({
        apiKey: key,
        baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        dangerouslyAllowBrowser: true // 在浏览器中直接调用 API
      });
    }
  }

  async process(input: string, history: AgentMessage[], onUpdate: (messages: AgentMessage[]) => void) {
    const currentHistory = [...history];
    const userMsg: AgentMessage = { role: 'user', content: input };
    currentHistory.push(userMsg);
    
    // 如果没有配置 API Key，退回到模拟模式
    if (!this.openai) {
      const thoughtMsg: AgentMessage = { role: 'thought', content: "⚠️ 未检测到 API Key，请在 .env.local 中配置 VITE_DASHSCOPE_API_KEY。" };
      onUpdate([...currentHistory, thoughtMsg]);
      await this.delay(1000);
      
      const assistantMsg: AgentMessage = { 
        role: 'assistant', 
        content: "你好！我目前运行在演示模式。请在项目根目录的 `.env.local` 文件中填入你的通义千问 API Key，然后重启开发服务器，我就能正式为你服务了！" 
      };
      currentHistory.push(assistantMsg);
      onUpdate([...currentHistory]);
      return;
    }

    // 真正的 API 调用 (带流式支持)
    try {
      const thoughtMsg: AgentMessage = { role: 'thought', content: "正在调用通义千问 API..." };
      onUpdate([...currentHistory, thoughtMsg]);

      const messages = history
        .filter(m => m.role !== 'thought')
        .map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        }));
      
      // 如果历史记录中没有 system 角色，则在最前面添加一个
      if (!messages.find(m => m.role === 'system')) {
        messages.unshift({
          role: 'system',
          content: this.systemPrompt
        });
      }
      
      messages.push({ role: 'user', content: input });

      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: messages,
        stream: true,
      });

      let fullContent = "";
      const assistantMsg: AgentMessage = { role: 'assistant', content: "" };
      
      // 移除思考状态，开始流式输出
      const historyWithoutThought = [...currentHistory];

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          assistantMsg.content = fullContent;
          onUpdate([...historyWithoutThought, assistantMsg]);
        }
      }
      
    } catch (error: any) {
      console.error("API Error:", error);
      const errorMsg: AgentMessage = { 
        role: 'assistant', 
        content: `抱歉，调用 API 时出错了: ${error.message || "未知错误"}` 
      };
      onUpdate([...currentHistory, errorMsg]);
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
