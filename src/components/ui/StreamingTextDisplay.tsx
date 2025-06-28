import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Fade, LinearProgress } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useGameTranslations } from '../../hooks/useGameTranslations';

interface StreamingTextDisplayProps {
  content: string;
  isStreaming: boolean;
  isComplete: boolean;
  showTypewriter?: boolean;
  onStreamingComplete?: () => void;
  onStreamingStart?: () => void;
  placeholder?: string;
}

// Cursor animation for typewriter effect
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

const StreamingCursor = styled('span')(({ theme }) => ({
  display: 'inline-block',
  width: '2px',
  height: '1.2em',
  backgroundColor: theme.palette.primary.main,
  marginLeft: '2px',
  animation: `${blink} 1s infinite`,
}));

const StreamingContainer = styled(Box)(() => ({
  position: 'relative',
  minHeight: '1.5em',
  width: '100%',
  '& > *': {
    minHeight: 'inherit',
  },
}));

// Unified JSON string extraction with escape handling
const extractJSONString = (content: string, fieldPath: string[]): string | null => {
  let pattern: RegExp;
  
  if (fieldPath.length === 1) {
    pattern = new RegExp(`"${fieldPath[0]}":\\s*"`);
  } else {
    // For nested fields like player.gender
    pattern = new RegExp(`"${fieldPath[0]}":[^}]*"${fieldPath[1]}":\\s*"`);
  }
  
  const match = content.match(pattern);
  if (!match) return null;
  
  const startIndex = match.index! + match[0].length;
  let result = '';
  let i = startIndex;
  
  while (i < content.length) {
    const char = content[i];
    
    if (char === '"') {
      // Check if quote is escaped (even number of preceding backslashes means not escaped)
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && content[j] === '\\') {
        backslashCount++;
        j--;
      }
      if (backslashCount % 2 === 0) break; // End of string
    }
    
    // Handle escape sequences
    if (char === '\\' && i + 1 < content.length) {
      const nextChar = content[i + 1];
      const escapeMap: { [key: string]: string } = {
        '"': '"', '\\': '\\', 'n': '\n', 't': '\t', 'r': '\r'
      };
      if (escapeMap[nextChar]) {
        result += escapeMap[nextChar];
        i += 2;
        continue;
      }
    }
    
    result += char;
    i++;
  }
  
  return result;
};

// Check if a JSON field is complete
const isFieldComplete = (content: string, fieldName: string): boolean => {
  return new RegExp(`"${fieldName}":\\s*"([^"\\\\]|\\\\.)*"`).test(content);
};

// Extract and format content from streaming JSON
const extractDisplayContent = (content: string): { text: string; isJSON: boolean } => {
  if (!content.trim()) return { text: '', isJSON: false };

  // Clean content - remove markdown code blocks
  let cleanedContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // For outcome streaming: truncate after outcome field
  if (cleanedContent.includes('"outcome"')) {
    const outcomeEndMatch = cleanedContent.match(/"outcome":\s*"([^"]+)"/);
    if (outcomeEndMatch) {
      const outcomeEndIndex = cleanedContent.indexOf(outcomeEndMatch[0]) + outcomeEndMatch[0].length;
      cleanedContent = cleanedContent.substring(0, outcomeEndIndex) + '}';
    }
  }

  // Try complete JSON parsing first
  try {
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.outcome) return formatOutcome(parsed);
      if (parsed.question) return formatQuestion(parsed);
      if (parsed.player || parsed.child) return formatInitialState(parsed);
    }
  } catch (e) {
    // Continue with progressive extraction
  }

  // Progressive extraction for incomplete JSON
  return extractProgressiveContent(cleanedContent);
};

// Content formatters
const formatOutcome = (parsed: any): { text: string; isJSON: boolean } => ({
  text: parsed.outcome,
  isJSON: false
});

const formatQuestion = (parsed: any): { text: string; isJSON: boolean } => {
  let text = `\n${parsed.question}\n\n`;
  
  if (parsed.options?.length) {
    text += "\n";
    parsed.options.forEach((option: any) => {
      text += `${option.id}: ${option.text}`;
      if (option.cost !== undefined && option.cost !== 0) {
        text += ` (费用: ${option.cost})`;
      }
      text += '\n';
    });
  }
  
  if (parsed.isExtremeEvent) {
    text += '\n⚠️ 这是一个重要事件\n';
  }
  
  return { text, isJSON: false };
};

const formatInitialState = (parsed: any): { text: string; isJSON: boolean } => {
  let text = "**游戏设定：**\n\n";
  
  if (parsed.player) {
    const parentRole = parsed.player.gender === 'male'
      ? '父亲'
      : parsed.player.gender === 'female'
        ? '母亲'
        : '家长';
    text += `**玩家：** ${parentRole}，${parsed.player.age}岁\n`;
  }
  
  if (parsed.child) {
    text += `**孩子：** ${parsed.child.name}（${parsed.child.gender === 'male' ? '男孩' : '女孩'}）\n\n`;
  }
  
  if (parsed.playerDescription) {
    text += `**背景：**\n${parsed.playerDescription}\n\n`;
  }
  
  if (parsed.childDescription) {
    text += `**孩子描述：**\n${parsed.childDescription}\n`;
  }
  
  if (parsed.wealthTier) {
    const wealthLabels = { poor: '贫困', middle: '中产', wealthy: '富裕' };
    text += `\n**家庭财富：** ${wealthLabels[parsed.wealthTier as keyof typeof wealthLabels] || parsed.wealthTier}\n`;
  }
  
  return { text, isJSON: false };
};

// Progressive content extraction for incomplete JSON
const extractProgressiveContent = (content: string): { text: string; isJSON: boolean } => {
  // Question content
  if (content.includes('"question"')) {
    const questionText = extractJSONString(content, ['question']);
    if (questionText !== null) {
      let text = questionText;
      
      if (!isFieldComplete(content, 'question') || !content.includes('"options"')) {
        text += '...';
      }
      
      // Extract options
      const optionsText = extractOptions(content);
      if (optionsText) {
        text += optionsText;
      } else if (content.includes('"options"')) {
        text += '\n';
      } else {
        text += '\n\n\n\n'; // Reserve space for options
      }
      
      return { text, isJSON: false };
    }
  }

  // Outcome content
  if (content.includes('"outcome"')) {
    const outcomeText = extractJSONString(content, ['outcome']);
    if (outcomeText !== null) {
      let text = outcomeText;
      if (!isFieldComplete(content, 'outcome')) {
        text += '...';
      }
      return { text, isJSON: false };
    }
  }

  // Initial state content
  if (content.includes('"player"') || content.includes('"child"')) {
    return extractInitialStateProgressive(content);
  }

  return { text: content.includes('{') ? '' : content, isJSON: false };
};

// Extract options from JSON content
const extractOptions = (content: string): string | null => {
  try {
    const optionsMatch = content.match(/"options":\s*\[([\s\S]*?)\]/);
    if (optionsMatch) {
      const options = JSON.parse(`[${optionsMatch[1]}]`);
      let text = "**选项：**\n";
      options.forEach((option: any) => {
        if (option.id && option.text) {
          text += `${option.id}: ${option.text}`;
          if (option.cost !== undefined && option.cost !== 0) {
            text += ` (费用: ${option.cost})`;
          }
          text += '\n';
        }
      });
      return text;
    }
  } catch (e) {
    // Extract partial options
    const optionMatches = content.match(/"id":\s*"([A-E])",\s*"text":\s*"((?:[^"\\]|\\.)*)"/g);
    if (optionMatches?.length) {
      let text = "**选项：**\n";
      optionMatches.forEach((match) => {
        const parts = match.match(/"id":\s*"([A-E])",\s*"text":\s*"((?:[^"\\]|\\.)*)"/);
        if (parts) {
          const unescapedText = parts[2]
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r');
          text += `${parts[1]}: ${unescapedText}\n`;
        }
      });
      return text;
    }
  }
  return null;
};

// Extract initial state progressively
const extractInitialStateProgressive = (content: string): { text: string; isJSON: boolean } => {
  let text = "**游戏设定：**\n\n";
  
  // Extract player info
  const playerGender = extractJSONString(content, ['player', 'gender']);
  const playerAgeMatch = content.match(/"player":[^}]*"age":\s*(\d+)/);
  
  if (playerGender) {
    const genderText = playerGender === 'male' ? '父亲' : playerGender === 'female' ? '母亲' : '家长';
    const ageText = playerAgeMatch ? `，${playerAgeMatch[1]}岁` : '';
    text += `**玩家：** ${genderText}${ageText}\n`;
  }
  
  // Extract child info
  const childName = extractJSONString(content, ['child', 'name']);
  const childGender = extractJSONString(content, ['child', 'gender']);
  
  if (childName) {
    const genderText = childGender === 'male' ? '男孩' : '女孩';
    text += `**孩子：** ${childName}${childGender ? `（${genderText}）` : ''}\n\n`;
  }
  
  // Extract descriptions
  const playerDesc = extractJSONString(content, ['playerDescription']);
  if (playerDesc) {
    text += `**背景：**\n${playerDesc}\n\n`;
  }
  
  const childDesc = extractJSONString(content, ['childDescription']);
  if (childDesc) {
    text += `**孩子描述：**\n${childDesc}\n`;
  }
  
  // Add loading indicator if incomplete
  if (!content.includes('}') || (!playerDesc && !childDesc)) {
    text += '\n正在生成更多设定...';
  }
  
  return { text, isJSON: false };
};

// Format text with styling
const formatText = (text: string): React.ReactNode => {
  return text.split('\n').map((line, index) => {
    let formattedLine: React.ReactNode = line;
    
    // Handle bold headers
    if (line.includes('**')) {
      const parts = line.split('**');
      formattedLine = parts.map((part, i) => {
        if (i % 2 === 1) {
          // Bold text styling based on content
          const headerStyles = {
            '问题：': {
              fontWeight: 600,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              color: 'text.secondary',
              display: 'block',
              mb: 2,
              textAlign: 'center',
            },
            default: {
              fontWeight: 600,
              fontSize: { xs: '1rem', sm: '1.125rem' },
              color: 'text.primary',
              display: 'block',
              mt: 2,
              mb: 1,
            }
          };
          
          const style = part === '问题：' ? headerStyles['问题：'] : headerStyles.default;
          
          return (
            <Typography key={i} component="span" sx={style}>
              {part}
            </Typography>
          );
        }
        return part;
      });
    }
    
    // Style question text
    if (index > 0 && text.split('\n')[index - 1].includes('**问题：**') && line.trim() && !line.includes('**')) {
      formattedLine = (
        <Typography
          component="div"
          sx={{
            fontWeight: 400,
            color: 'text.primary',
            lineHeight: 1.6,
            fontSize: { xs: '1rem', sm: '1.125rem' },
            textAlign: 'left',
            mb: 4,
            mt: 1,
          }}
        >
          {line}
        </Typography>
      );
    }
    
    // Style option lines
    if (line.match(/^[A-E]:\s/)) {
      formattedLine = (
        <Typography
          component="div"
          sx={{
            fontWeight: 500,
            color: 'text.primary',
            fontSize: { xs: '1rem', sm: '1.125rem' },
            py: 0.5,
            pl: 1,
          }}
        >
          {line}
        </Typography>
      );
    }
    
    return (
      <React.Fragment key={index}>
        {formattedLine}
        {index < text.split('\n').length - 1 && !React.isValidElement(formattedLine) && <br />}
      </React.Fragment>
    );
  });
};

export const StreamingTextDisplay: React.FC<StreamingTextDisplayProps> = ({
  content,
  isStreaming,
  isComplete,
  showTypewriter = true,
  onStreamingComplete,
  onStreamingStart,
  placeholder
}) => {
  const { t } = useGameTranslations();
  const defaultPlaceholder = placeholder || t('game.loading');
  const [displayedContent, setDisplayedContent] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [minHeight, setMinHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef('');
  const hasStartedStreamingRef = useRef(false);

  // Track content height to prevent shrinking
  useEffect(() => {
    if (contentRef.current) {
      const currentHeight = contentRef.current.scrollHeight;
      const isOutcomeContent = !displayedContent.includes('**') && displayedContent.length > 0;
      if (!isOutcomeContent && currentHeight > minHeight) {
        setMinHeight(currentHeight);
      }
    }
  }, [displayedContent, minHeight]);

  // Handle typewriter effect
  useEffect(() => {
    if (!content) {
      setDisplayedContent('');
      setShowCursor(false);
      setMinHeight(0);
      hasStartedStreamingRef.current = false;
      return;
    }

    const { text: extractedText } = extractDisplayContent(content);
    
    if (showTypewriter && isStreaming && extractedText !== lastContentRef.current) {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }

      if (!hasStartedStreamingRef.current && onStreamingStart) {
        hasStartedStreamingRef.current = true;
        onStreamingStart();
      }

      setShowCursor(true);
      const currentLength = displayedContent.length;
      
      if (extractedText.length > currentLength) {
        let index = currentLength;
        const typeNextChunk = () => {
          if (index < extractedText.length) {
            const chunkSize = 10;
            let nextIndex = Math.min(index + chunkSize, extractedText.length);
            
            // Try to break at word boundaries
            if (nextIndex < extractedText.length) {
              const charAtBreak = extractedText[nextIndex];
              const charBeforeBreak = extractedText[nextIndex - 1];
              
              if (charAtBreak && !charAtBreak.match(/[\s，。！？：\n]/) && 
                  charBeforeBreak && !charBeforeBreak.match(/[\s，。！？：\n]/)) {
                for (let i = 1; i <= 5 && (nextIndex + i) < extractedText.length; i++) {
                  if (extractedText[nextIndex + i].match(/[\s，。！？：\n]/)) {
                    nextIndex = nextIndex + i;
                    break;
                  }
                }
              }
            }
            
            const nextChunk = extractedText.slice(index, nextIndex);
            let speed = 80;
            
            if (nextChunk.match(/[，。！？：]/)) speed = 150;
            else if (nextChunk.match(/[\n\*]/)) speed = 50;
            
            setDisplayedContent(extractedText.slice(0, nextIndex));
            index = nextIndex;
            typewriterRef.current = setTimeout(typeNextChunk, speed);
          }
        };
        typeNextChunk();
      } else if (extractedText !== displayedContent) {
        setDisplayedContent(extractedText);
      }
      
      lastContentRef.current = extractedText;
    } else {
      const { text: extractedText } = extractDisplayContent(content);
      setDisplayedContent(extractedText);
      lastContentRef.current = extractedText;
    }
  }, [content, isStreaming, showTypewriter, displayedContent]);

  // Handle completion
  useEffect(() => {
    if (isComplete) {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
        typewriterRef.current = null;
      }
      
      const { text: extractedText } = extractDisplayContent(content);
      setDisplayedContent(extractedText);
      setShowCursor(false);
      hasStartedStreamingRef.current = false;
      
      if (onStreamingComplete) {
        setTimeout(onStreamingComplete, 100);
      }
    }
  }, [isComplete, content, onStreamingComplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, []);

  // Show placeholder when no content
  if (!content && isStreaming) {
    const isOutcomePlaceholder = defaultPlaceholder.includes('结果');
    
    return (
      <StreamingContainer>
        <Fade in timeout={300}>
          <Box sx={{ minHeight: isOutcomePlaceholder ? 60 : 200 }}>
            <LinearProgress 
              sx={{ 
                mb: 2, 
                height: 4, 
                borderRadius: 2,
                backgroundColor: 'rgba(0,0,0,0.1)'
              }} 
            />
            <Typography color="text.secondary" sx={{ fontStyle: 'italic', mb: isOutcomePlaceholder ? 0 : 4 }}>
              {defaultPlaceholder}
            </Typography>
            
            {!isOutcomePlaceholder && (
              <Box sx={{ opacity: 0.3 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>问题：</Typography>
                <Box sx={{ height: 60, mb: 3, backgroundColor: 'action.hover', borderRadius: 1 }} />
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>选项：</Typography>
                <Box sx={{ height: 120, backgroundColor: 'action.hover', borderRadius: 1 }} />
              </Box>
            )}
          </Box>
        </Fade>
      </StreamingContainer>
    );
  }

  const { isJSON } = extractDisplayContent(content);
  const isOutcomeContent = !displayedContent.includes('**') && displayedContent.length > 0;

  return (
    <StreamingContainer>
      <Typography
        ref={contentRef}
        component="div"
        sx={{
          fontSize: { xs: '1rem', sm: '1.125rem' },
          lineHeight: 1.6,
          color: 'text.primary',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          textAlign: 'left',
          minHeight: isOutcomeContent ? 'auto' : (minHeight > 0 ? `${minHeight}px` : 'auto'),
          transition: isOutcomeContent ? 'none' : 'min-height 0.3s ease-out',
          ...(isJSON && {
            fontFamily: 'monospace',
            fontSize: { xs: '0.875rem', sm: '1rem' },
            backgroundColor: 'grey.100',
            padding: 2,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'grey.300',
            maxHeight: 400,
            overflow: 'auto',
          }),
        }}
      >
        {formatText(displayedContent)}
        {isStreaming && showCursor && showTypewriter && <StreamingCursor />}
      </Typography>
    </StreamingContainer>
  );
}; 