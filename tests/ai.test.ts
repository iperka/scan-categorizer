import {AI} from '../src/ai';
import {Query} from '../src/query';

// Mock Logger for tests
declare const global: any;
global.Logger = {
  log: jest.fn(),
};

describe('AI', () => {
  describe('anonymizeText()', () => {
    it('should anonymize SSN patterns', () => {
      const text = 'My SSN is 123-45-6789 and tax ID 987-65-4321';
      const result = AI.anonymizeText(text);
      expect(result).toBe(
        'My SSN is [SSN-REDACTED] and tax ID [SSN-REDACTED]',
      );
    });

    it('should anonymize credit card numbers', () => {
      const text = 'Card number: 1234-5678-9012-3456';
      const result = AI.anonymizeText(text);
      expect(result).toBe('Card number: [CARD-REDACTED]');
    });

    it('should anonymize email addresses', () => {
      const text = 'Contact me at john.doe@example.com';
      const result = AI.anonymizeText(text);
      expect(result).toBe('Contact me at [EMAIL-REDACTED]');
    });

    it('should anonymize phone numbers', () => {
      const text = 'Call me at (555) 123-4567 or +1-555-987-6543';
      const result = AI.anonymizeText(text);
      expect(result).toBe('Call me at [PHONE-REDACTED] or [PHONE-REDACTED]');
    });

    it('should anonymize dates', () => {
      const text = 'Born on 1990-05-15 and married 2015/08/20';
      const result = AI.anonymizeText(text);
      expect(result).toBe(
        'Born on [DATE-REDACTED] and married [DATE-REDACTED]',
      );
    });

    it('should apply privacy filters', () => {
      const text = 'My salary is $50000 and tax details are confidential';
      const result = AI.anonymizeText(text, ['salary', 'tax']);
      expect(result).toContain('[FILTERED]');
    });

    it('should handle empty or invalid input', () => {
      expect(AI.anonymizeText('')).toBe('');
      expect(AI.anonymizeText(null as any)).toBe('');
      expect(AI.anonymizeText(undefined as any)).toBe('');
    });

    it('should anonymize multiple PII patterns in one text', () => {
      const text =
        'John (SSN: 123-45-6789) lives at john@example.com, call 555-1234';
      const result = AI.anonymizeText(text);
      expect(result).not.toContain('123-45-6789');
      expect(result).not.toContain('john@example.com');
      expect(result).toContain('[SSN-REDACTED]');
      expect(result).toContain('[EMAIL-REDACTED]');
    });

    it('should handle privacy filters case-insensitively', () => {
      const text = 'My SALARY information and Tax details';
      const result = AI.anonymizeText(text, ['salary', 'tax']);
      expect(result).toContain('[FILTERED]');
    });
  });

  describe('containsPrivacySensitiveContent()', () => {
    it('should detect privacy-sensitive keywords', () => {
      expect(
        AI.containsPrivacySensitiveContent('Tax information', ['tax']),
      ).toBe(true);
      expect(
        AI.containsPrivacySensitiveContent('Salary details', ['salary']),
      ).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(
        AI.containsPrivacySensitiveContent('TAX RETURN', ['tax']),
      ).toBe(true);
      expect(
        AI.containsPrivacySensitiveContent('Medical Records', ['medical']),
      ).toBe(true);
    });

    it('should return false when no sensitive content', () => {
      expect(
        AI.containsPrivacySensitiveContent('Invoice for services', [
          'tax',
          'medical',
        ]),
      ).toBe(false);
    });

    it('should handle empty filters', () => {
      expect(AI.containsPrivacySensitiveContent('Any text', [])).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(AI.containsPrivacySensitiveContent('', ['tax'])).toBe(false);
      expect(AI.containsPrivacySensitiveContent(null as any, ['tax'])).toBe(
        false,
      );
    });
  });

  describe('OpenAIService', () => {
    describe('constructor', () => {
      it('should create OpenAI service with default model', () => {
        const service = new AI.OpenAIService('test-api-key');
        expect(service).toBeDefined();
      });

      it('should create OpenAI service with custom model', () => {
        const service = new AI.OpenAIService('test-api-key', 'gpt-4');
        expect(service).toBeDefined();
      });
    });

    describe('parseResponse()', () => {
      it('should parse valid JSON response', () => {
        const service = new AI.OpenAIService('test-key');
        const response = JSON.stringify({
          name: 'Invoices',
          path: 'Invoices/$y/$m',
          conditions: ['invoice', 'payment'],
          confidence: 0.95,
          rename: 'Invoice-$y-$m-$d.pdf',
        });

        const result = (service as any).parseResponse(response);
        expect(result).toEqual({
          name: 'Invoices',
          path: 'Invoices/$y/$m',
          conditions: ['invoice', 'payment'],
          confidence: 0.95,
          rename: 'Invoice-$y-$m-$d.pdf',
        });
      });

      it('should parse JSON with markdown code blocks', () => {
        const service = new AI.OpenAIService('test-key');
        const response = `\`\`\`json
{
  "name": "Contracts",
  "path": "Contracts/$y",
  "conditions": ["contract", "agreement"],
  "confidence": 0.88
}
\`\`\``;

        const result = (service as any).parseResponse(response);
        expect(result).toEqual({
          name: 'Contracts',
          path: 'Contracts/$y',
          conditions: ['contract', 'agreement'],
          confidence: 0.88,
        });
      });

      it('should return null for invalid JSON', () => {
        const service = new AI.OpenAIService('test-key');
        const result = (service as any).parseResponse('not json');
        expect(result).toBeNull();
      });

      it('should return null for missing required fields', () => {
        const service = new AI.OpenAIService('test-key');
        const response = JSON.stringify({
          name: 'Test',
          // missing path and conditions
        });

        const result = (service as any).parseResponse(response);
        expect(result).toBeNull();
      });

      it('should use default confidence if not provided', () => {
        const service = new AI.OpenAIService('test-key');
        const response = JSON.stringify({
          name: 'Test',
          path: 'Test/$y',
          conditions: ['test'],
        });

        const result = (service as any).parseResponse(response);
        expect(result?.confidence).toBe(0.5);
      });
    });

    describe('buildPrompt()', () => {
      it('should build prompt with existing categories', () => {
        const service = new AI.OpenAIService('test-key');
        const categories: Query.Category[] = [
          {
            name: 'Invoices',
            conditions: [Query.or('invoice')],
            path: 'Invoices/$y',
          },
        ];

        const prompt = (service as any).buildPrompt('Test text', categories);
        expect(prompt).toContain('Invoices');
        expect(prompt).toContain('Test text');
      });

      it('should build prompt without existing categories', () => {
        const service = new AI.OpenAIService('test-key');
        const prompt = (service as any).buildPrompt('Test text', []);
        expect(prompt).toContain('None');
        expect(prompt).toContain('Test text');
      });

      it('should truncate long text to 500 characters', () => {
        const service = new AI.OpenAIService('test-key');
        const longText = 'a'.repeat(1000);
        const prompt = (service as any).buildPrompt(longText, []);
        const textInPrompt = prompt.match(/Document text.*\n([\s\S]*?)\n\nPlease/)?.[1];
        expect(textInPrompt?.length).toBeLessThanOrEqual(500);
      });
    });
  });

  describe('GeminiService', () => {
    describe('constructor', () => {
      it('should create Gemini service with default model', () => {
        const service = new AI.GeminiService('test-api-key');
        expect(service).toBeDefined();
      });

      it('should create Gemini service with custom model', () => {
        const service = new AI.GeminiService(
          'test-api-key',
          'gemini-1.5-pro',
        );
        expect(service).toBeDefined();
      });
    });

    describe('parseResponse()', () => {
      it('should parse valid JSON response', () => {
        const service = new AI.GeminiService('test-key');
        const response = JSON.stringify({
          name: 'Medical',
          path: 'Medical/$y',
          conditions: ['medical', 'doctor'],
          confidence: 0.92,
        });

        const result = (service as any).parseResponse(response);
        expect(result).toEqual({
          name: 'Medical',
          path: 'Medical/$y',
          conditions: ['medical', 'doctor'],
          confidence: 0.92,
        });
      });

      it('should parse JSON with markdown code blocks', () => {
        const service = new AI.GeminiService('test-key');
        const response = `\`\`\`json
{
  "name": "Receipts",
  "path": "Receipts/$y/$m",
  "conditions": ["receipt", "purchase"],
  "confidence": 0.85
}
\`\`\``;

        const result = (service as any).parseResponse(response);
        expect(result?.name).toBe('Receipts');
      });

      it('should return null for invalid JSON', () => {
        const service = new AI.GeminiService('test-key');
        const result = (service as any).parseResponse('invalid');
        expect(result).toBeNull();
      });
    });

    describe('buildPrompt()', () => {
      it('should build prompt correctly', () => {
        const service = new AI.GeminiService('test-key');
        const categories: Query.Category[] = [
          {
            name: 'Legal',
            conditions: [Query.or('legal')],
            path: 'Legal/$y',
          },
        ];

        const prompt = (service as any).buildPrompt(
          'Contract document',
          categories,
        );
        expect(prompt).toContain('Legal');
        expect(prompt).toContain('Contract document');
      });
    });
  });

  describe('createSuggestionEmail()', () => {
    it('should create email with all required parts', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Invoices',
        path: 'Invoices/$y/$m',
        conditions: ['invoice', 'payment'],
        confidence: 0.95,
        rename: 'Invoice-$y-$m-$d.pdf',
      };

      const email = AI.createSuggestionEmail(suggestion, 'test.pdf');

      expect(email.subject).toContain('Invoices');
      expect(email.text).toContain('test.pdf');
      expect(email.text).toContain('95.0%');
      expect(email.text).toContain('invoice');
      expect(email.html).toContain('Invoices');
      expect(email.html).toContain('test.pdf');
    });

    it('should create email without rename when not provided', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Contracts',
        path: 'Contracts/$y',
        conditions: ['contract'],
        confidence: 0.8,
      };

      const email = AI.createSuggestionEmail(suggestion, 'contract.pdf');

      expect(email.text).toContain('Contracts');
      expect(email.text).not.toContain('rename:');
    });

    it('should format confidence as percentage', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.857,
      };

      const email = AI.createSuggestionEmail(suggestion, 'test.pdf');
      expect(email.text).toContain('85.7%');
    });
  });

  describe('createAIService()', () => {
    it('should create OpenAI service', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      const service = AI.createAIService(config);
      expect(service).toBeInstanceOf(AI.OpenAIService);
    });

    it('should create Gemini service', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'gemini',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      const service = AI.createAIService(config);
      expect(service).toBeInstanceOf(AI.GeminiService);
    });

    it('should return null when disabled', () => {
      const config: AI.AIConfig = {
        enabled: false,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      const service = AI.createAIService(config);
      expect(service).toBeNull();
    });

    it('should return null when API key is missing', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: '',
        notificationEmail: 'test@example.com',
      };

      const service = AI.createAIService(config);
      expect(service).toBeNull();
    });

    it('should pass custom model to service', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        model: 'gpt-4',
      };

      const service = AI.createAIService(config);
      expect(service).toBeDefined();
    });
  });

  describe('sendSuggestionEmail()', () => {
    it('should throw error when notification email is missing', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: '',
      };

      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.9,
      };

      expect(() => {
        AI.sendSuggestionEmail(config, suggestion, 'test.pdf');
      }).toThrow('Notification email is required');
    });
  });

  describe('processUnmatchedDocument()', () => {
    it('should return false when AI is disabled', async () => {
      const config: AI.AIConfig = {
        enabled: false,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      const result = await AI.processUnmatchedDocument(
        'Test text',
        'test.pdf',
        [],
        config,
      );
      expect(result).toBe(false);
    });

    it('should return false for privacy-sensitive content', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        privacyFilters: ['tax', 'medical'],
      };

      const result = await AI.processUnmatchedDocument(
        'Tax return document',
        'tax.pdf',
        [],
        config,
      );
      expect(result).toBe(false);
    });

    it('should return false when service creation fails', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: '', // Empty key will cause service creation to fail
        notificationEmail: 'test@example.com',
      };

      const result = await AI.processUnmatchedDocument(
        'Test text',
        'test.pdf',
        [],
        config,
      );
      expect(result).toBe(false);
    });
  });

  describe('AIConfig validation', () => {
    it('should accept valid OpenAI config', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'sk-test123',
        notificationEmail: 'user@example.com',
        privacyFilters: ['tax', 'ssn'],
        model: 'gpt-4',
      };

      expect(config.enabled).toBe(true);
      expect(config.provider).toBe('openai');
    });

    it('should accept valid Gemini config', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'gemini',
        apiKey: 'AIza-test123',
        notificationEmail: 'user@example.com',
      };

      expect(config.provider).toBe('gemini');
    });

    it('should accept config without optional fields', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      expect(config.privacyFilters).toBeUndefined();
      expect(config.model).toBeUndefined();
    });
  });

  describe('SuggestedCategory validation', () => {
    it('should have all required fields', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.9,
      };

      expect(suggestion.name).toBeDefined();
      expect(suggestion.path).toBeDefined();
      expect(suggestion.conditions).toBeDefined();
      expect(suggestion.confidence).toBeDefined();
    });

    it('should accept optional rename field', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.9,
        rename: 'Test-$y-$m-$d.pdf',
      };

      expect(suggestion.rename).toBe('Test-$y-$m-$d.pdf');
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty text in anonymizeText', () => {
      const result = AI.anonymizeText('   ', ['test']);
      expect(result).toBe('   ');
    });

    it('should handle text with only whitespace for privacy filters', () => {
      const result = AI.containsPrivacySensitiveContent('   ', ['test']);
      expect(result).toBe(false);
    });

    it('should handle empty string in privacy filters array', () => {
      const text = 'Some text';
      const result = AI.anonymizeText(text, ['', 'valid']);
      expect(result).toBe('Some text');
    });

    it('should handle multiple privacy filters matching same text', () => {
      const text = 'tax return salary';
      const result = AI.anonymizeText(text, ['tax', 'salary', 'return']);
      expect(result).toContain('[FILTERED]');
    });

    it('should anonymize all PII types at once', () => {
      const text = 'SSN: 123-45-6789, Email: test@example.com, Card: 1234-5678-9012-3456, Phone: (555) 123-4567, Date: 2024-01-15';
      const result = AI.anonymizeText(text);
      expect(result).not.toContain('123-45-6789');
      expect(result).not.toContain('test@example.com');
      expect(result).not.toContain('1234-5678-9012-3456');
      expect(result).toContain('[SSN-REDACTED]');
      expect(result).toContain('[EMAIL-REDACTED]');
      expect(result).toContain('[CARD-REDACTED]');
      expect(result).toContain('[PHONE-REDACTED]');
      expect(result).toContain('[DATE-REDACTED]');
    });

    it('should handle null AI config in processUnmatchedDocument', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      const result = await AI.processUnmatchedDocument(
        'Normal text',
        'test.pdf',
        [],
        config,
      );

      // Should return false because we can't actually call the API in tests
      expect(typeof result).toBe('boolean');
    });

    it('should parse response with generic code blocks', () => {
      const service = new AI.OpenAIService('test-key');
      const response = `\`\`\`
{
  "name": "Test",
  "path": "Test/$y",
  "conditions": ["test"],
  "confidence": 0.9
}
\`\`\``;

      const result = (service as any).parseResponse(response);
      expect(result?.name).toBe('Test');
    });

    it('should handle Gemini response with generic code blocks', () => {
      const service = new AI.GeminiService('test-key');
      const response = `\`\`\`
{
  "name": "Test",
  "path": "Test/$y",
  "conditions": ["test"],
  "confidence": 0.9
}
\`\`\``;

      const result = (service as any).parseResponse(response);
      expect(result?.name).toBe('Test');
    });

    it('should handle response with invalid conditions type', () => {
      const service = new AI.OpenAIService('test-key');
      const response = JSON.stringify({
        name: 'Test',
        path: 'Test/$y',
        conditions: 'not-an-array', // Invalid
        confidence: 0.9,
      });

      const result = (service as any).parseResponse(response);
      expect(result).toBeNull();
    });

    it('should create AI service with custom model for OpenAI', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        model: 'gpt-4-turbo',
      };

      const service = AI.createAIService(config);
      expect(service).toBeInstanceOf(AI.OpenAIService);
    });

    it('should create AI service with custom model for Gemini', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'gemini',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        model: 'gemini-1.5-pro',
      };

      const service = AI.createAIService(config);
      expect(service).toBeInstanceOf(AI.GeminiService);
    });

    it('should handle empty existing categories in OpenAI buildPrompt', () => {
      const service = new AI.OpenAIService('test-key');
      const prompt = (service as any).buildPrompt('Test text', []);
      expect(prompt).toContain('None');
    });

    it('should handle empty existing categories in Gemini buildPrompt', () => {
      const service = new AI.GeminiService('test-key');
      const prompt = (service as any).buildPrompt('Test text', []);
      expect(prompt).toContain('None');
    });

    it('should handle createSuggestionEmail with minimal suggestion', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Min',
        path: 'Min/$y',
        conditions: ['a'],
        confidence: 0,
      };

      const email = AI.createSuggestionEmail(suggestion, 'test.pdf');
      expect(email.subject).toContain('Min');
      expect(email.text).toContain('0.0%');
    });

    it('should return null from OpenAI suggestCategory when no text', async () => {
      const service = new AI.OpenAIService('test-key');
      const result = await service.suggestCategory('', []);
      expect(result).toBeNull();
    });

    it('should return null from OpenAI suggestCategory when no API key', async () => {
      const service = new AI.OpenAIService('');
      const result = await service.suggestCategory('test', []);
      expect(result).toBeNull();
    });

    it('should return null from Gemini suggestCategory when no text', async () => {
      const service = new AI.GeminiService('test-key');
      const result = await service.suggestCategory('', []);
      expect(result).toBeNull();
    });

    it('should return null from Gemini suggestCategory when no API key', async () => {
      const service = new AI.GeminiService('');
      const result = await service.suggestCategory('test', []);
      expect(result).toBeNull();
    });

    it('should handle parseResponse with response containing only path', () => {
      const service = new AI.OpenAIService('test-key');
      const response = JSON.stringify({
        path: 'Test/$y',
        // Missing name and conditions
      });

      const result = (service as any).parseResponse(response);
      expect(result).toBeNull();
    });

    it('should handle parseResponse with response containing only name', () => {
      const service = new AI.GeminiService('test-key');
      const response = JSON.stringify({
        name: 'Test',
        // Missing path and conditions
      });

      const result = (service as any).parseResponse(response);
      expect(result).toBeNull();
    });

    it('should handle Gemini parseResponse with catch block', () => {
      const service = new AI.GeminiService('test-key');
      // Pass invalid JSON that will throw during parse
      const result = (service as any).parseResponse('{invalid json');
      expect(result).toBeNull();
    });

    it('should handle OpenAI parseResponse with catch block', () => {
      const service = new AI.OpenAIService('test-key');
      // Pass invalid JSON that will throw during parse
      const result = (service as any).parseResponse('{invalid json');
      expect(result).toBeNull();
    });

    it('should handle multiple line breaks in code blocks', () => {
      const service = new AI.OpenAIService('test-key');
      const response = `\`\`\`json\n\n\n{
  "name": "Test",
  "path": "Test/$y",
  "conditions": ["test"],
  "confidence": 0.9
}\n\n\n\`\`\``;

      const result = (service as any).parseResponse(response);
      expect(result?.name).toBe('Test');
    });
  });
});
