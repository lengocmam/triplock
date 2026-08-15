import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { getEmbedding } from './utils/embedding.util';

@Injectable()
export class KnowledgeBaseService {
  private logger = new Logger('KnowledgeBase');
  private apiKey: string;

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('GEMINI_API_KEY') || '';
  }

  // Nạp tài liệu vào knowledge base: tính embedding rồi insert bằng raw SQL
  async ingestDocument(topic: string, content: string): Promise<void> {
    const embedding = await getEmbedding(this.apiKey, content);
    const vectorLiteral = `[${embedding.join(',')}]`;

    await this.dataSource.query(
      `INSERT INTO knowledge_chunks (topic, content, embedding) VALUES ($1, $2, $3::vector)`,
      [topic, content, vectorLiteral],
    );
  }

  async ingestBatch(docs: { topic: string; content: string }[]): Promise<{ inserted: number }> {
    for (const doc of docs) {
      await this.ingestDocument(doc.topic, doc.content);
    }
    return { inserted: docs.length };
  }

  async clearAll(): Promise<{ message: string }> {
    await this.dataSource.query('DELETE FROM knowledge_chunks');
    return { message: 'Đã xóa toàn bộ knowledge base' };
  }

  // RAG THẬT: embed câu hỏi, tìm top-K đoạn tài liệu gần nhất bằng cosine distance (<=>)
  // trực tiếp trong Postgres qua pgvector — không tự tính similarity ở tầng ứng dụng như semantic cache cũ
  async search(query: string, topK = 3): Promise<{ topic: string; content: string; similarity: number }[]> {
    const embedding = await getEmbedding(this.apiKey, query);
    const vectorLiteral = `[${embedding.join(',')}]`;

    const rows = await this.dataSource.query(
      `SELECT topic, content, 1 - (embedding <=> $1::vector) AS similarity
       FROM knowledge_chunks
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vectorLiteral, topK],
    );

    return rows.map((r: any) => ({
      topic: r.topic,
      content: r.content,
      similarity: Number(r.similarity),
    }));
  }
}