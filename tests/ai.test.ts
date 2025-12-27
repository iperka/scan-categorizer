import {AI} from '../src/ai';
import {Query} from '../src/query';

// Mock Logger for tests
declare const global: any;
global.Logger = {
  log: jest.fn(),
};

// Mock Helpers.sendEmail
jest.mock('../src/helpers', () => ({
  Helpers: {
    sendEmail: jest.fn(),
    sanitizeFileName: jest.fn((str) => str),
  },
}));

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
    it('should return DISABLED when AI is disabled', async () => {
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
      expect(result).toBe(AI.AIProcessingResult.DISABLED);
    });

    it('should return PRIVACY_BLOCKED for privacy-sensitive content', async () => {
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
      expect(result).toBe(AI.AIProcessingResult.PRIVACY_BLOCKED);
    });

    it('should return SERVICE_FAILED when service creation fails', async () => {
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
      expect(result).toBe(AI.AIProcessingResult.SERVICE_FAILED);
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
        dryRun: true, // Use dry-run mode
      };

      const result = await AI.processUnmatchedDocument(
        'Normal text',
        'test.pdf',
        [],
        config,
      );

      // Should return DRY_RUN result
      expect(result).toBe(AI.AIProcessingResult.DRY_RUN);
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

  describe('validateCategorySuggestion()', () => {
    it('should validate a valid suggestion', () => {
      const suggestion = {
        name: 'Invoices',
        path: 'Invoices/$y/$m',
        conditions: ['invoice', 'bill'],
        confidence: 0.95,
        rename: 'Invoice-$y-$m-$d.pdf',
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Invoices');
      expect(result?.path).toBe('Invoices/$y/$m');
      expect(result?.conditions).toEqual(['invoice', 'bill']);
      expect(result?.confidence).toBe(0.95);
      expect(result?.rename).toBe('Invoice-$y-$m-$d.pdf');
    });

    it('should reject suggestion with missing required fields', () => {
      const suggestion = {
        name: 'Test',
        // missing path and conditions
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with empty name', () => {
      const suggestion = {
        name: '',
        path: 'Test/$y',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with path too short', () => {
      const suggestion = {
        name: 'Test',
        path: 'T$y',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion without $y in path', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$m/$d',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with invalid placeholder in path', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y/$z',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with too many conditions', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: Array(25).fill('test'),
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with empty conditions array', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: [] as string[],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject rename not ending with .pdf', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        rename: 'Test-$y-$m-$d.txt',
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should normalize confidence to 0-1 range', () => {
      const suggestion1 = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 1.5,
      };

      const result1 = AI.validateCategorySuggestion(suggestion1);
      expect(result1?.confidence).toBe(1);

      const suggestion2 = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: -0.5,
      };

      const result2 = AI.validateCategorySuggestion(suggestion2);
      expect(result2?.confidence).toBe(0);
    });

    it('should use default confidence if not provided', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result?.confidence).toBe(0.5);
    });

    it('should trim whitespace from fields', () => {
      const suggestion = {
        name: '  Test  ',
        path: '  Test/$y  ',
        conditions: ['  test  ', '  keyword  '],
        rename: '  Test-$y.pdf  ',
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result?.name).toBe('Test');
      expect(result?.path).toBe('Test/$y');
      expect(result?.conditions).toEqual(['test', 'keyword']);
      expect(result?.rename).toBe('Test-$y.pdf');
    });
  });

  describe('AIRunState', () => {
    it('should track AI call count', () => {
      const state = new AI.AIRunState();
      expect(state.getAICallCount()).toBe(0);

      state.incrementAICallCount();
      expect(state.getAICallCount()).toBe(1);

      state.incrementAICallCount();
      expect(state.getAICallCount()).toBe(2);
    });

    it('should enforce rate limit', () => {
      const state = new AI.AIRunState();
      expect(state.canMakeAICall(2)).toBe(true);

      state.incrementAICallCount();
      expect(state.canMakeAICall(2)).toBe(true);

      state.incrementAICallCount();
      expect(state.canMakeAICall(2)).toBe(false);
    });

    it('should track processed documents', () => {
      const state = new AI.AIRunState();
      const fp = state.createDocumentFingerprint('test.pdf', 'test content');

      expect(state.isDocumentProcessed(fp)).toBe(false);

      state.markDocumentProcessed(fp);
      expect(state.isDocumentProcessed(fp)).toBe(true);
    });

    it('should create consistent fingerprints', () => {
      const state = new AI.AIRunState();
      const fp1 = state.createDocumentFingerprint('test.pdf', 'test content');
      const fp2 = state.createDocumentFingerprint('test.pdf', 'test content');

      expect(fp1).toBe(fp2);
    });

    it('should create different fingerprints for different documents', () => {
      const state = new AI.AIRunState();
      const fp1 = state.createDocumentFingerprint('test1.pdf', 'content 1');
      const fp2 = state.createDocumentFingerprint('test2.pdf', 'content 2');

      expect(fp1).not.toBe(fp2);
    });

    it('should reset state', () => {
      const state = new AI.AIRunState();
      state.incrementAICallCount();
      state.incrementAICallCount();
      const fp = state.createDocumentFingerprint('test.pdf', 'content');
      state.markDocumentProcessed(fp);

      expect(state.getAICallCount()).toBe(2);
      expect(state.isDocumentProcessed(fp)).toBe(true);

      state.reset();

      expect(state.getAICallCount()).toBe(0);
      expect(state.isDocumentProcessed(fp)).toBe(false);
    });
  });

  describe('processUnmatchedDocument with new features', () => {
    it('should respect rate limit', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        maxAICallsPerRun: 1,
        dryRun: true, // Use dry-run to avoid actual API calls
      };

      const state = new AI.AIRunState();

      // First call should succeed
      const result1 = await AI.processUnmatchedDocument(
        'Test text',
        'test1.pdf',
        [],
        config,
        state,
      );
      expect(result1).toBe(AI.AIProcessingResult.DRY_RUN);

      // Second call should be blocked by rate limit
      const result2 = await AI.processUnmatchedDocument(
        'Test text 2',
        'test2.pdf',
        [],
        config,
        state,
      );

      expect(result2).toBe(AI.AIProcessingResult.RATE_LIMITED);
    });

    it('should detect duplicate documents', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        dryRun: true, // Use dry-run to avoid actual API calls
      };

      const state = new AI.AIRunState();

      // Process same document twice
      await AI.processUnmatchedDocument(
        'Test text',
        'test.pdf',
        [],
        config,
        state,
      );

      const result2 = await AI.processUnmatchedDocument(
        'Test text',
        'test.pdf',
        [],
        config,
        state,
      );

      expect(result2).toBe(AI.AIProcessingResult.DUPLICATE);
    });

    it('should work in dry-run mode', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        dryRun: true,
      };

      const result = await AI.processUnmatchedDocument(
        'Test text',
        'test.pdf',
        [],
        config,
      );

      expect(result).toBe(AI.AIProcessingResult.DRY_RUN);
      // In dry-run, it should log but not send email
      expect(global.Logger.log).toHaveBeenCalledWith(
        expect.stringContaining('[DRY-RUN]'),
      );
    });

    it('should use default maxAICallsPerRun if not specified', async () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
      };

      const state = new AI.AIRunState();

      // Should allow up to 10 calls by default
      for (let i = 0; i < 10; i++) {
        expect(state.canMakeAICall(10)).toBe(true);
        state.incrementAICallCount();
      }

      expect(state.canMakeAICall(10)).toBe(false);
    });
  });

  describe('AIConfig with new options', () => {
    it('should accept dryRun option', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        dryRun: true,
      };

      expect(config.dryRun).toBe(true);
    });

    it('should accept maxAICallsPerRun option', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        maxAICallsPerRun: 5,
      };

      expect(config.maxAICallsPerRun).toBe(5);
    });

    it('should accept maxTextLength option', () => {
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        maxTextLength: 5000,
      };

      expect(config.maxTextLength).toBe(5000);
    });
  });

  describe('createSuggestionEmail() with validation', () => {
    it('should throw error for invalid suggestion', () => {
      const invalidSuggestion = {
        name: '',
        path: 'Invalid',
        conditions: [],
      } as any;

      expect(() => {
        AI.createSuggestionEmail(invalidSuggestion, 'test.pdf');
      }).toThrow('Cannot create email: suggestion failed validation');
    });

    it('should include disclaimer in email', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.9,
      };

      const email = AI.createSuggestionEmail(suggestion, 'test.pdf');
      
      expect(email.text).toContain('Review this suggestion before using');
      expect(email.html).toContain('Review Before Use');
    });

    it('should sanitize fileName in email', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.9,
      };

      const email = AI.createSuggestionEmail(suggestion, 'test<script>.pdf');
      
      expect(email.html).not.toContain('<script>');
      expect(email.html).toContain('&lt;script&gt;');
    });

    it('should validate JSON is parseable', () => {
      const suggestion: AI.SuggestedCategory = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        confidence: 0.9,
      };

      const email = AI.createSuggestionEmail(suggestion, 'test.pdf');
      
      // JSON should be valid
      expect(() => {
        const match = email.text.match(/JSON Configuration for category array:\n([\s\S]*?)\n\nTo add/);
        if (match) {
          JSON.parse(match[1]);
        }
      }).not.toThrow();
    });
  });

  describe('Text length limiting', () => {
    it('should truncate text to maxTextLength', async () => {
      const longText = 'A'.repeat(5000);
      const config: AI.AIConfig = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        notificationEmail: 'test@example.com',
        maxTextLength: 1000,
        dryRun: true,
      };

      const result = await AI.processUnmatchedDocument(
        longText,
        'test.pdf',
        [],
        config,
      );

      expect(result).toBe(AI.AIProcessingResult.DRY_RUN);
      // In dry-run, it logs the text length
    });
  });

  describe('validateCategorySuggestion edge cases', () => {
    it('should reject null suggestion', () => {
      const result = AI.validateCategorySuggestion(null);
      expect(result).toBeNull();
    });

    it('should reject non-object suggestion', () => {
      const result = AI.validateCategorySuggestion('not an object');
      expect(result).toBeNull();
    });

    it('should reject suggestion with name longer than max', () => {
      const suggestion = {
        name: 'A'.repeat(101),
        path: 'Test/$y',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with path longer than max', () => {
      const suggestion = {
        name: 'Test',
        path: 'A'.repeat(501) + '/$y',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with condition longer than max', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['A'.repeat(101)],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject suggestion with empty condition string', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test', '', 'another'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject rename longer than max', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        rename: 'A'.repeat(256) + '.pdf',
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should reject rename with invalid placeholder', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        rename: 'Test-$y-$z.pdf',
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).toBeNull();
    });

    it('should accept all valid placeholders in path', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y/$l/$m/$d/$h/$i/$s',
        conditions: ['test'],
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).not.toBeNull();
    });

    it('should accept all valid placeholders in rename', () => {
      const suggestion = {
        name: 'Test',
        path: 'Test/$y',
        conditions: ['test'],
        rename: 'Test-$y-$l-$m-$d-$h-$i-$s.pdf',
      };

      const result = AI.validateCategorySuggestion(suggestion);
      expect(result).not.toBeNull();
    });
  });

  describe('buildPrompt with multiple categories', () => {
    it('should build OpenAI prompt with multiple existing categories', () => {
      const service = new AI.OpenAIService('test-key');
      const categories: Query.Category[] = [
        {
          name: 'Invoices',
          conditions: [Query.or('invoice')],
          path: 'Invoices/$y',
        },
        {
          name: 'Receipts',
          conditions: [Query.or('receipt')],
          path: 'Receipts/$y/$m',
        },
      ];

      const prompt = (service as any).buildPrompt('Test document text', categories);
      expect(prompt).toContain('Invoices, Receipts');
      expect(prompt).toContain('Test document text');
    });

    it('should build Gemini prompt with multiple existing categories', () => {
      const service = new AI.GeminiService('test-key');
      const categories: Query.Category[] = [
        {
          name: 'Contracts',
          conditions: [Query.or('contract')],
          path: 'Contracts/$y',
        },
        {
          name: 'Reports',
          conditions: [Query.or('report')],
          path: 'Reports/$y/$m',
        },
      ];

      const prompt = (service as any).buildPrompt('Test report text', categories);
      expect(prompt).toContain('Contracts, Reports');
      expect(prompt).toContain('Test report text');
    });
  });
});
