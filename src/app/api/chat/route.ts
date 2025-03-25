import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { prisma, openai, getEmbedding, findSimilarMessages, analyzeEmotions, extractTopics } from '@/lib/db';

const SYSTEM_PROMPT = `You are an empathetic and supportive AI therapist. Your role is to:
1. Listen actively and respond with empathy
2. Help users explore their thoughts and feelings
3. Provide supportive guidance and coping strategies
4. Encourage professional help when appropriate
5. Maintain appropriate boundaries and ethical guidelines
6. Never diagnose or prescribe medication
7. Always prioritize user safety and well-being

If users express thoughts of self-harm or suicide, immediately encourage them to:
1. Contact emergency services (911 in the US)
2. Call the National Suicide Prevention Lifeline (988)
3. Reach out to a trusted friend, family member, or mental health professional

Remember: You are not a replacement for professional mental health services.`;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, conversationId } = await req.json();
    const userMessage = messages[messages.length - 1];

    // Get or create conversation
    let conversation = conversationId
      ? await prisma.conversation.findUnique({ where: { id: conversationId } })
      : await prisma.conversation.create({
          data: {
            userId: session.user.id,
          },
        });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Get message embedding
    const embedding = await getEmbedding(userMessage.content);

    // Find similar messages for context
    const similarMessages = await findSimilarMessages(embedding);

    // Analyze emotions and topics
    const emotions = await analyzeEmotions(userMessage.content);
    const topics = await extractTopics(userMessage.content);

    // Store user message
    await prisma.message.create({
      data: {
        content: userMessage.content,
        role: 'user',
        embedding,
        conversationId: conversation.id,
        emotions: {
          create: emotions.map((e: any) => ({
            name: e.name,
            intensity: e.intensity,
            userId: session.user.id,
            conversationId: conversation.id,
          })),
        },
        topics: {
          create: topics.map((t: string) => ({
            name: t,
            userId: session.user.id,
            conversationId: conversation.id,
          })),
        },
      },
    });

    // Generate AI response with context
    const contextMessages = similarMessages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...contextMessages.slice(-3), // Use last 3 similar messages as context
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = response.choices[0].message.content;
    const assistantEmbedding = await getEmbedding(assistantMessage);

    // Store assistant message
    await prisma.message.create({
      data: {
        content: assistantMessage,
        role: 'assistant',
        embedding: assistantEmbedding,
        conversationId: conversation.id,
      },
    });

    return NextResponse.json({
      message: assistantMessage,
      conversationId: conversation.id,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 