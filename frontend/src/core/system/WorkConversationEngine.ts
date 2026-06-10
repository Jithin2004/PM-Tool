/**
 * WorkConversationEngine
 * Parses workspace comments for structured interactions: mentions, questions, and decisions.
 */
export interface WorkConversationAnalysis {
  isDecision: boolean;
  hasQuestion: boolean;
  mentions: Array<{
    userId: string;
    email: string;
    fullName: string;
    requiresResponse: boolean;
  }>;
}

export const WorkConversationEngine = {
  /**
   * Parses the text comment content to extract mentions, questions, and decisions.
   */
  analyzeComment(content: string, users: any[]): WorkConversationAnalysis {
    const text = content.trim();
    const lowerText = text.toLowerCase();

    // 1. Question Detection
    const questionPatterns = [
      /\bcan\s+you\b/i,
      /\bshould\s+we\b/i,
      /\bneed\s+confirmation\b/i,
      /\bplease\s+confirm\b/i,
      /\bconfirm\s+this\b/i
    ];
    const hasQuestion = questionPatterns.some(pattern => pattern.test(text)) || text.endsWith('?');

    // 2. Decision Comment Detection
    const decisionPatterns = [
      /^approved\b/i,
      /^reject\s+because/i,
      /^proceed\s+with\s+option\s+[a-z0-9]/i,
      /^decision:/i,
      /^approved\s+because/i,
      /^proceed\b/i
    ];
    const isDecision = decisionPatterns.some(pattern => pattern.test(text));

    // 3. Mentions Extraction
    const mentions: WorkConversationAnalysis['mentions'] = [];
    const mentionRegex = /@([a-zA-Z0-9_.-]+)/g;
    let match;
    const extractedNames: string[] = [];
    
    while ((match = mentionRegex.exec(text)) !== null) {
      extractedNames.push(match[1].toLowerCase());
    }

    if (extractedNames.length > 0 && Array.isArray(users)) {
      users.forEach(u => {
        const email = (u.email || '').toLowerCase();
        const fullName = (u.full_name || '').toLowerCase();
        
        const isMatched = extractedNames.some(name => 
          email.includes(name) || 
          fullName.includes(name)
        );

        if (isMatched) {
          mentions.push({
            userId: u.id,
            email: u.email || '',
            fullName: u.full_name || '',
            requiresResponse: true // mentions in this workflow require response
          });
        }
      });
    }

    return {
      isDecision,
      hasQuestion,
      mentions
    };
  }
};
