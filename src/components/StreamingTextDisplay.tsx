import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Fade, LinearProgress } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';

interface StreamingTextDisplayProps {
  content: string;
  isStreaming: boolean;
  isComplete: boolean;
  showTypewriter?: boolean;
  onStreamingComplete?: () => void;
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

// LoadingDots component removed - not currently used

const StreamingContainer = styled(Box)(() => ({
  position: 'relative',
  minHeight: '1.5em',
  width: '100%',
  // Ensure container only grows, never shrinks
  '& > *': {
    minHeight: 'inherit',
  },
}));

// Extract and progressively format content from streaming JSON
const extractDisplayContent = (content: string, showJSON: boolean): { text: string; isJSON: boolean } => {
  if (!content.trim()) {
    return { text: '', isJSON: false };
  }

  if (showJSON) {
    // For raw JSON display, format it nicely
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        return { text: JSON.stringify(parsed, null, 2), isJSON: true };
      }
    } catch (e) {
      // If parsing fails, just return as-is
    }
    return { text: content, isJSON: true };
  }

  // Clean the content first - remove any markdown code blocks
  let cleanedContent = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  // FOR OUTCOME STREAMING: Stop processing after the outcome is complete
  if (cleanedContent.includes('"outcome"')) {
    // Find the end of the outcome field and truncate content there
    const outcomeEndMatch = cleanedContent.match(/"outcome":\s*"([^"]+)"/);
    if (outcomeEndMatch) {
      // Only process content up to the end of the outcome field
      const outcomeEndIndex = cleanedContent.indexOf(outcomeEndMatch[0]) + outcomeEndMatch[0].length;
      cleanedContent = cleanedContent.substring(0, outcomeEndIndex) + '}';
    }
  }

  // Progressive parsing - try to extract information as it becomes available
  const result = extractProgressiveContent(cleanedContent);
  return result;
};

// Enhanced progressive content extraction for smooth streaming
const extractProgressiveContent = (content: string): { text: string; isJSON: boolean } => {
  let displayText = '';
  
  // Try to parse complete JSON first
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // Handle complete JSON parsing
      if (parsed.outcome) {
        // Always prioritize outcome formatting when outcome exists
        return formatOutcomeContent(parsed);
      } else if (parsed.question) {
        return formatQuestionContent(parsed);
      } else if (parsed.player || parsed.child) {
        return formatInitialStateContent(parsed);
      }
    }
  } catch (e) {
    // JSON incomplete or malformed, continue with progressive extraction
  }

  // Progressive extraction for incomplete JSON
  // Extract question content progressively
  if (content.includes('"question"')) {
    const questionMatch = content.match(/"question":\s*"([^"]*)/);
    if (questionMatch) {
      let questionText = questionMatch[1];
      
      // Check if question text is complete
      const completeQuestionMatch = content.match(/"question":\s*"([^"]+)"/);
      if (completeQuestionMatch) {
        questionText = completeQuestionMatch[1];
      }
      
      displayText += `${questionText}`;
      
      // Add loading indicator if question seems incomplete
      if (!completeQuestionMatch || !content.includes('"options"')) {
        displayText += '...';
      }
     
     
      
      // Try to extract options progressively
      const optionsText = extractOptionsProgressively(content);
      if (optionsText) {
        displayText += optionsText.replace('**选项：**\n', ''); // Remove duplicate header
      } else if (content.includes('"options"')) {
        displayText += '正在加载选项...\n';
      } else {
        // Reserve space for 4 options to prevent layout shift
        displayText += '\n\n\n\n';
      }
      
      return { text: displayText, isJSON: false };
    }
  }

  // Extract outcome content progressively
  if (content.includes('"outcome"')) {
    const outcomeMatch = content.match(/"outcome":\s*"([^"]*)/);
    if (outcomeMatch) {
      let outcomeText = outcomeMatch[1];
      
      // Check if outcome text is complete
      const completeOutcomeMatch = content.match(/"outcome":\s*"([^"]+)"/);
      if (completeOutcomeMatch) {
        outcomeText = completeOutcomeMatch[1];
      }
      
      displayText += `${outcomeText}`;
      
      // Add loading indicator if outcome seems incomplete
      if (!completeOutcomeMatch) {
        displayText += '...';
      }
      
      return { text: displayText, isJSON: false };
    }
  }

  // Extract initial state progressively
  if (content.includes('"player"') || content.includes('"child"')) {
    return extractInitialStateProgressively(content);
  }

  // Fallback for unrecognized content
  if (content.includes('{')) {
    // Provide a structured placeholder while parsing
    return { 
      text: '', 
      isJSON: false 
    };
  }
  
  return { text: content, isJSON: false };
};

// Helper functions for formatting different content types
const formatQuestionContent = (parsed: any): { text: string; isJSON: boolean } => {
  let displayText = `\n${parsed.question}\n\n`;
  
  if (parsed.options && Array.isArray(parsed.options)) {
    displayText += "\n";
    parsed.options.forEach((option: any) => {
      displayText += `${option.id}: ${option.text}`;
      if (option.cost !== undefined && option.cost !== 0) {
        displayText += ` (费用: ${option.cost})`;
      }
      displayText += '\n';
    });
  }
  
  if (parsed.isExtremeEvent) {
    displayText += '\n⚠️ 这是一个重要事件\n';
  }
  
  return { text: displayText, isJSON: false };
};

const formatOutcomeContent = (parsed: any): { text: string; isJSON: boolean } => {
  // For outcome streaming, only show the outcome text, not the next question
  let displayText = `${parsed.outcome}`;
  
  return { text: displayText, isJSON: false };
};

const formatInitialStateContent = (parsed: any): { text: string; isJSON: boolean } => {
  let displayText = "**游戏设定：**\n\n";
  
  if (parsed.player) {
    displayText += `**玩家：** ${parsed.player.gender === 'male' ? '父亲' : '母亲'}，${parsed.player.age}岁\n`;
  }
  
  if (parsed.child) {
    displayText += `**孩子：** ${parsed.child.name}（${parsed.child.gender === 'male' ? '男孩' : '女孩'}）\n\n`;
  }
  
  if (parsed.playerDescription) {
    displayText += `**背景：**\n${parsed.playerDescription}\n\n`;
  }
  
  if (parsed.childDescription) {
    displayText += `**孩子描述：**\n${parsed.childDescription}\n`;
  }
  
  if (parsed.wealthTier) {
    const wealthLabels = { poor: '贫困', middle: '中产', wealthy: '富裕' };
    displayText += `\n**家庭财富：** ${wealthLabels[parsed.wealthTier as keyof typeof wealthLabels] || parsed.wealthTier}\n`;
  }
  
  return { text: displayText, isJSON: false };
};

// Progressive extraction helpers
const extractOptionsProgressively = (content: string): string | null => {
  try {
    const optionsMatch = content.match(/"options":\s*\[([\s\S]*?)\]/);
    if (optionsMatch) {
      const optionsStr = `[${optionsMatch[1]}]`;
      const options = JSON.parse(optionsStr);
      
      let optionsText = "**选项：**\n";
      options.forEach((option: any) => {
        if (option.id && option.text) {
          optionsText += `${option.id}: ${option.text}`;
          if (option.cost !== undefined && option.cost !== 0) {
            optionsText += ` (费用: ${option.cost})`;
          }
          optionsText += '\n';
        }
      });
      
      return optionsText;
    }
  } catch (e) {
    // Try to extract partial options
    const partialOptions = extractPartialOptions(content);
    if (partialOptions) {
      return "**选项：**\n" + partialOptions;
    }
  }
  
  return null;
};

const extractPartialOptions = (content: string): string | null => {
  const optionMatches = content.match(/"id":\s*"([A-E])",\s*"text":\s*"([^"]+)"/g);
  if (optionMatches && optionMatches.length > 0) {
    let optionsText = '';
    optionMatches.forEach((match) => {
      const parts = match.match(/"id":\s*"([A-E])",\s*"text":\s*"([^"]+)"/);
      if (parts) {
        optionsText += `${parts[1]}: ${parts[2]}\n`;
      }
    });
    return optionsText;
  }
  return null;
};

// extractNextQuestionProgressively function removed - not currently used

const extractInitialStateProgressively = (content: string): { text: string; isJSON: boolean } => {
  let displayText = "**游戏设定：**\n\n";
  
  // Try to extract player info
  const playerGenderMatch = content.match(/"player":[^}]*"gender":\s*"([^"]+)"/);
  const playerAgeMatch = content.match(/"player":[^}]*"age":\s*(\d+)/);
  
  if (playerGenderMatch) {
    const genderText = playerGenderMatch[1] === 'male' ? '父亲' : '母亲';
    const ageText = playerAgeMatch ? `，${playerAgeMatch[1]}岁` : '';
    displayText += `**玩家：** ${genderText}${ageText}\n`;
  }
  
  // Try to extract child info
  const childNameMatch = content.match(/"child":[^}]*"name":\s*"([^"]+)"/);
  const childGenderMatch = content.match(/"child":[^}]*"gender":\s*"([^"]+)"/);
  
  if (childNameMatch) {
    const childGenderText = childGenderMatch ? 
      (childGenderMatch[1] === 'male' ? '男孩' : '女孩') : '';
    displayText += `**孩子：** ${childNameMatch[1]}${childGenderText ? `（${childGenderText}）` : ''}\n\n`;
  }
  
  // Try to extract descriptions
  const playerDescMatch = content.match(/"playerDescription":\s*"([^"]+)"/);
  if (playerDescMatch) {
    displayText += `**背景：**\n${playerDescMatch[1]}\n\n`;
  }
  
  const childDescMatch = content.match(/"childDescription":\s*"([^"]+)"/);
  if (childDescMatch) {
    displayText += `**孩子描述：**\n${childDescMatch[1]}\n`;
  }
  
  // Add loading indicator if content seems incomplete
  if (!content.includes('}') || (!playerDescMatch && !childDescMatch)) {
    displayText += '\n正在生成更多设定...';
  }
  
  return { text: displayText, isJSON: false };
};

// Format text with enhanced styling to match QuestionDisplay
const formatText = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  
  return lines.map((line, index) => {
    let formattedLine: React.ReactNode = line;
    
    // Handle bold headers with enhanced styling
    if (line.includes('**')) {
      const parts = line.split('**');
      formattedLine = parts.map((part, i) => {
        if (i % 2 === 1) {
          // This is bold text - check if it's a question header
          if (part === '问题：') {
            return (
              <Typography
                key={i}
                component="span"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  color: 'text.secondary',
                  display: 'block',
                  mb: 2,
                  textAlign: 'center',
                }}
              >
                {part}
              </Typography>
            );
          } else if (part === '选项：' || part === '结果：' || part === '游戏设定：' || part === '下一个问题：') {
            return (
              <Typography
                key={i}
                component="span"
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  color: 'text.primary',
                  display: 'block',
                  mt: 2,
                  mb: 1,
                }}
              >
                {part}
              </Typography>
            );
          } else {
            return (
              <Typography
                key={i}
                component="span"
                sx={{ fontWeight: 600, color: 'text.primary' }}
              >
                {part}
              </Typography>
            );
          }
        }
        return part;
      });
    }
    
    // Style the actual question text to match QuestionDisplay exactly
    if (index > 0 && lines[index - 1].includes('**问题：**') && line.trim() && !line.includes('**')) {
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
        {index < lines.length - 1 && !React.isValidElement(formattedLine) && <br />}
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
  placeholder = "正在生成内容..."
}) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const [minHeight, setMinHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef('');

  // Track content height to prevent shrinking
  useEffect(() => {
    if (contentRef.current) {
      const currentHeight = contentRef.current.scrollHeight;
      // For outcome content (plain text without headers), disable height tracking entirely
      const isOutcomeContent = !displayedContent.includes('**') && displayedContent.length > 0;
      if (!isOutcomeContent) {
        // Only use height tracking for questions/other structured content
        if (currentHeight > minHeight) {
          setMinHeight(currentHeight);
        }
      }
      // For outcomes, don't track height at all to prevent shrinking effect
    }
  }, [displayedContent, minHeight]);

  // Handle typewriter effect for new content
  useEffect(() => {
    if (!content) {
      setDisplayedContent('');
      setShowCursor(false);
      setMinHeight(0); // Reset minimum height when content is cleared
      return;
    }

    // Extract meaningful content (always use formatted display)
    const { text: extractedText } = extractDisplayContent(content, false);
    
    if (showTypewriter && isStreaming && extractedText !== lastContentRef.current) {
      // Clear existing typewriter
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }

      // Start typewriter effect for new content
      setShowCursor(true);
      const newContent = extractedText;
      const currentLength = displayedContent.length;
      
      if (newContent.length > currentLength) {
        // Smart typewriter: display 10 characters at a time for smooth reading
        let index = currentLength;
        const typeNextChunk = () => {
          if (index < newContent.length) {
            const chunkSize = 10; // Display 10 characters at a time
            let nextIndex = Math.min(index + chunkSize, newContent.length);
            
            // Try to break at word boundaries when possible (for better readability)
            if (nextIndex < newContent.length) {
              const charAtBreak = newContent[nextIndex];
              const charBeforeBreak = newContent[nextIndex - 1];
              
              // If we're in the middle of a word, try to extend to complete it
              if (charAtBreak && !charAtBreak.match(/[\s，。！？：\n]/) && 
                  charBeforeBreak && !charBeforeBreak.match(/[\s，。！？：\n]/)) {
                // Look ahead up to 5 more characters for a word boundary
                for (let i = 1; i <= 5 && (nextIndex + i) < newContent.length; i++) {
                  if (newContent[nextIndex + i].match(/[\s，。！？：\n]/)) {
                    nextIndex = nextIndex + i;
                    break;
                  }
                }
              }
            }
            
            const nextChunk = newContent.slice(index, nextIndex);
            let speed = 100; // Base speed for chunk
            
            // Adjust speed based on content type
            if (nextChunk.match(/[，。！？：]/)) {
              speed = 150; // Slower for punctuation to allow reading
            }
            // Faster for structural elements
            else if (nextChunk.match(/[\n\*]/)) {
              speed = 50;
            }
            // Normal speed for regular text
            else {
              speed = 80;
            }
            setDisplayedContent(newContent.slice(0, nextIndex));
            index = nextIndex;
            typewriterRef.current = setTimeout(typeNextChunk, speed);
          }
        };
        typeNextChunk();
      } else if (newContent !== displayedContent) {
        // Content changed significantly, update immediately (e.g., format change)
        setDisplayedContent(newContent);
      }
      
      lastContentRef.current = extractedText;
    } else {
      // Not using typewriter or not streaming, just set content directly
      const { text: extractedText } = extractDisplayContent(content, false);
      setDisplayedContent(extractedText);
      lastContentRef.current = extractedText;
    }
  }, [content, isStreaming, showTypewriter]);

  // Handle completion
  useEffect(() => {
    if (isComplete) {
      // Clear any ongoing typewriter
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
        typewriterRef.current = null;
      }
      
      // Smooth transition to final content without re-animation
      const { text: extractedText } = extractDisplayContent(content, false);
      
      // Just ensure we have the final content and hide cursor
      setDisplayedContent(extractedText);
      setShowCursor(false);
      
      // Call completion callback immediately
      if (onStreamingComplete) {
        setTimeout(onStreamingComplete, 100);
      }
    }
  }, [isComplete, content, onStreamingComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, []);

  // Show placeholder when no content yet
  if (!content && isStreaming) {
    // For outcome streaming, show minimal placeholder
    if (placeholder.includes('结果')) {
      return (
        <StreamingContainer>
          <Fade in timeout={300}>
            <Box sx={{ minHeight: 60 }}> {/* Much smaller height for outcomes */}
              <LinearProgress 
                sx={{ 
                  mb: 2, 
                  height: 4, 
                  borderRadius: 2,
                  backgroundColor: 'rgba(0,0,0,0.1)'
                }} 
              />
              <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {placeholder}
              </Typography>
            </Box>
          </Fade>
        </StreamingContainer>
      );
    }
    
    // For question streaming, show full placeholder structure
    return (
      <StreamingContainer>
        <Fade in timeout={300}>
          <Box sx={{ minHeight: 200 }}> {/* Reserve minimum height */}
            <LinearProgress 
              sx={{ 
                mb: 2, 
                height: 4, 
                borderRadius: 2,
                backgroundColor: 'rgba(0,0,0,0.1)'
              }} 
            />
            <Typography color="text.secondary" sx={{ fontStyle: 'italic', mb: 4 }}>
              {placeholder}
            </Typography>
            
            {/* Reserve space for expected content structure */}
            <Box sx={{ opacity: 0.3 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                问题：
              </Typography>
              <Box sx={{ height: 60, mb: 3, backgroundColor: 'action.hover', borderRadius: 1 }} />
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                选项：
              </Typography>
              <Box sx={{ height: 120, backgroundColor: 'action.hover', borderRadius: 1 }} />
            </Box>
          </Box>
        </Fade>
      </StreamingContainer>
    );
  }

  // Always use formatted display
  const { isJSON } = extractDisplayContent(content, false);



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
          // Only apply minHeight for structured content (questions), not for plain outcome text
          minHeight: (!displayedContent.includes('**') && displayedContent.length > 0) ? 'auto' : (minHeight > 0 ? `${minHeight}px` : 'auto'),
          transition: (!displayedContent.includes('**') && displayedContent.length > 0) ? 'none' : 'min-height 0.3s ease-out',
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