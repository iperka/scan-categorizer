/* eslint-disable no-unused-vars */
import {Helpers} from './helpers';
import {Query} from './query';

export namespace AI {
  /**
   * Configuration for AI-powered categorization.
   */
  export interface AIConfig {
    /**
     * Enable AI categorization (opt-in).
     */
    enabled: boolean;

    /**
     * AI provider to use.
     */
    provider: 'openai' | 'gemini';

    /**
     * API key for the selected provider.
     */
    apiKey: string;

    /**
     * Email address to send category suggestions to.
     */
    notificationEmail: string;

    /**
     * Categories/keywords that should never be sent to AI for privacy.
     * Example: ['tax', 'ssn', 'salary', 'medical']
     */
    privacyFilters?: string[];

    /**
     * Model to use (optional, uses provider defaults if not specified).
     */
    model?: string;

    /**
     * Dry-run mode: test filtering/redaction without calling AI providers.
     * Logs what would be sent and what would be emailed.
     */
    dryRun?: boolean;

    /**
     * Maximum number of AI calls per run (rate limiting).
     * Default: 10
     */
    maxAICallsPerRun?: number;
  }

  /**
   * Suggested category from AI.
   */
  export interface SuggestedCategory {
    /**
     * Suggested name for the category.
     */
    name: string;

    /**
     * Suggested path pattern.
     */
    path: string;

    /**
     * Suggested conditions (keywords).
     */
    conditions: string[];

    /**
     * Confidence score (0-1).
     */
    confidence: number;

    /**
     * Optional rename pattern.
     */
    rename?: string;
  }

  /**
   * Allowed placeholders in path and rename patterns.
   */
  const ALLOWED_PLACEHOLDERS = ['$y', '$l', '$m', '$d', '$h', '$i', '$s'];

  /**
   * Maximum limits for category suggestions.
   */
  const SUGGESTION_LIMITS = {
    MAX_NAME_LENGTH: 100,
    MAX_PATH_LENGTH: 500,
    MAX_RENAME_LENGTH: 255,
    MAX_CONDITIONS: 20,
    MAX_CONDITION_LENGTH: 100,
  };

  /**
   * Validates and normalizes a category suggestion.
   *
   * @param {any} suggestion Raw suggestion object to validate.
   * @return {SuggestedCategory | null} Validated suggestion or null if invalid.
   */
  export const validateCategorySuggestion = (
    suggestion: any,
  ): SuggestedCategory | null => {
    // Check required fields
    if (
      !suggestion ||
      typeof suggestion !== 'object' ||
      !suggestion.name ||
      !suggestion.path ||
      !suggestion.conditions ||
      !Array.isArray(suggestion.conditions)
    ) {
      Logger.log('Invalid suggestion: missing required fields');
      return null;
    }

    // Validate name
    const name = String(suggestion.name).trim();
    if (name.length === 0 || name.length > SUGGESTION_LIMITS.MAX_NAME_LENGTH) {
      Logger.log(
        `Invalid name: must be 1-${SUGGESTION_LIMITS.MAX_NAME_LENGTH} characters`,
      );
      return null;
    }

    // Validate path
    const path = String(suggestion.path).trim();
    if (path.length < 4 || path.length > SUGGESTION_LIMITS.MAX_PATH_LENGTH) {
      Logger.log(
        `Invalid path: must be 4-${SUGGESTION_LIMITS.MAX_PATH_LENGTH} characters`,
      );
      return null;
    }

    // Check for valid placeholders in path
    const pathPlaceholders = path.match(/\$[a-z]/g) || [];
    const invalidPathPlaceholders = pathPlaceholders.filter(
      (p) => !ALLOWED_PLACEHOLDERS.includes(p),
    );
    if (invalidPathPlaceholders.length > 0) {
      Logger.log(
        `Invalid placeholders in path: ${invalidPathPlaceholders.join(', ')}`,
      );
      return null;
    }

    // Path must include $y
    if (!path.includes('$y')) {
      Logger.log('Invalid path: must include $y placeholder');
      return null;
    }

    // Validate conditions
    if (suggestion.conditions.length > SUGGESTION_LIMITS.MAX_CONDITIONS) {
      Logger.log(
        `Too many conditions: max ${SUGGESTION_LIMITS.MAX_CONDITIONS}`,
      );
      return null;
    }

    const conditions: string[] = [];
    for (const cond of suggestion.conditions) {
      const condStr = String(cond).trim();
      if (
        condStr.length === 0 ||
        condStr.length > SUGGESTION_LIMITS.MAX_CONDITION_LENGTH
      ) {
        Logger.log(
          `Invalid condition: must be 1-${SUGGESTION_LIMITS.MAX_CONDITION_LENGTH} characters`,
        );
        return null;
      }
      conditions.push(condStr);
    }

    if (conditions.length === 0) {
      Logger.log('Invalid suggestion: at least one condition required');
      return null;
    }

    // Validate confidence
    const confidence =
      typeof suggestion.confidence === 'number'
        ? Math.max(0, Math.min(1, suggestion.confidence))
        : 0.5;

    // Validate rename (optional)
    let rename: string | undefined;
    if (suggestion.rename) {
      rename = String(suggestion.rename).trim();
      if (rename.length > SUGGESTION_LIMITS.MAX_RENAME_LENGTH) {
        Logger.log(
          `Invalid rename: max ${SUGGESTION_LIMITS.MAX_RENAME_LENGTH} characters`,
        );
        return null;
      }

      // Check for valid placeholders in rename
      const renamePlaceholders = rename.match(/\$[a-z]/g) || [];
      const invalidRenamePlaceholders = renamePlaceholders.filter(
        (p) => !ALLOWED_PLACEHOLDERS.includes(p),
      );
      if (invalidRenamePlaceholders.length > 0) {
        Logger.log(
          `Invalid placeholders in rename: ${invalidRenamePlaceholders.join(', ')}`,
        );
        return null;
      }

      // Rename must end with .pdf
      if (!rename.endsWith('.pdf')) {
        Logger.log('Invalid rename: must end with .pdf');
        return null;
      }
    }

    return {
      name,
      path,
      conditions,
      confidence,
      rename,
    };
  };

  /**
   * Interface for AI service providers.
   */
  export interface AIService {
    /**
     * Analyze document text and suggest a category.
     *
     * @param text Document text to analyze.
     * @param existingCategories Existing categories for context.
     * @return Suggested category or null if no suggestion.
     */
    suggestCategory(
      text: string,
      existingCategories: Query.Category[],
    ): Promise<SuggestedCategory | null>;
  }

  /**
   * Rate limiting and deduplication state for a single run.
   */
  export class AIRunState {
    private aiCallCount: number = 0;
    private processedDocuments: Set<string> = new Set();

    /**
     * Check if we can make another AI call.
     *
     * @param {number} maxCalls Maximum calls allowed per run.
     * @return {boolean} True if another call is allowed.
     */
    canMakeAICall(maxCalls: number): boolean {
      return this.aiCallCount < maxCalls;
    }

    /**
     * Increment AI call counter.
     */
    incrementAICallCount(): void {
      this.aiCallCount++;
    }

    /**
     * Get current AI call count.
     *
     * @return {number} Number of AI calls made.
     */
    getAICallCount(): number {
      return this.aiCallCount;
    }

    /**
     * Create a fingerprint for a document.
     *
     * @param {string} fileName File name.
     * @param {string} text Document text.
     * @return {string} Document fingerprint.
     */
    createDocumentFingerprint(fileName: string, text: string): string {
      // Simple fingerprint: hash of filename + first 1000 chars of text
      const content = fileName + text.substring(0, 1000);
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(36);
    }

    /**
     * Check if document has already been processed.
     *
     * @param {string} fingerprint Document fingerprint.
     * @return {boolean} True if already processed.
     */
    isDocumentProcessed(fingerprint: string): boolean {
      return this.processedDocuments.has(fingerprint);
    }

    /**
     * Mark document as processed.
     *
     * @param {string} fingerprint Document fingerprint.
     */
    markDocumentProcessed(fingerprint: string): void {
      this.processedDocuments.add(fingerprint);
    }

    /**
     * Reset the state for a new run.
     */
    reset(): void {
      this.aiCallCount = 0;
      this.processedDocuments.clear();
    }
  }

  /**
   * Anonymizes sensitive information in text.
   *
   * @param {string} text Text to anonymize.
   * @param {string[]} privacyFilters Keywords that trigger privacy protection.
   * @return {string} Anonymized text.
   */
  export const anonymizeText = (
    text: string,
    privacyFilters: string[] = [],
  ): string => {
    if (!text || typeof text !== 'string') return '';

    let anonymized = text;

    // Remove common PII patterns
    // Social Security Numbers (various formats)
    anonymized = anonymized.replace(
      /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
      '[SSN-REDACTED]',
    );

    // Credit card numbers (basic pattern)
    anonymized = anonymized.replace(
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      '[CARD-REDACTED]',
    );

    // Email addresses
    anonymized = anonymized.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      '[EMAIL-REDACTED]',
    );

    // Phone numbers (various formats)
    anonymized = anonymized.replace(
      /(\+\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
      '[PHONE-REDACTED]',
    );

    // Dates (to prevent date-based identification)
    anonymized = anonymized.replace(
      /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g,
      '[DATE-REDACTED]',
    );

    // Check for privacy filter keywords
    const lowerText = anonymized.toLowerCase();
    for (const filter of privacyFilters) {
      const filterLower = filter.toLowerCase().trim();
      if (filterLower && lowerText.includes(filterLower)) {
        // Replace the keyword and surrounding context
        const regex = new RegExp(
          `\\b[^\\s]*${filterLower}[^\\s]*\\b`,
          'gi',
        );
        anonymized = anonymized.replace(regex, '[FILTERED]');
      }
    }

    return anonymized;
  };

  /**
   * Checks if text contains privacy-sensitive content.
   *
   * @param {string} text Text to check.
   * @param {string[]} privacyFilters Keywords that indicate privacy-sensitive content.
   * @return {boolean} True if text should not be sent to AI.
   */
  export const containsPrivacySensitiveContent = (
    text: string,
    privacyFilters: string[] = [],
  ): boolean => {
    if (!text || typeof text !== 'string') return false;

    const lowerText = text.toLowerCase();

    for (const filter of privacyFilters) {
      const filterLower = filter.toLowerCase().trim();
      if (filterLower && lowerText.includes(filterLower)) {
        return true;
      }
    }

    return false;
  };

  /**
   * OpenAI service implementation.
   */
  export class OpenAIService implements AIService {
    private apiKey: string;
    private model: string;

    /**
     * Constructor for OpenAI service.
     *
     * @param {string} apiKey OpenAI API key.
     * @param {string} model Model to use (default: gpt-4o-mini).
     */
    constructor(apiKey: string, model: string = 'gpt-4o-mini') {
      this.apiKey = apiKey;
      this.model = model;
    }

    /**
     * Suggest a category for the given text.
     *
     * @param {string} text Document text to analyze.
     * @param {Query.Category[]} existingCategories Existing categories for context.
     * @return {Promise<SuggestedCategory | null>} Suggested category or null.
     */
    async suggestCategory(
      text: string,
      existingCategories: Query.Category[],
    ): Promise<SuggestedCategory | null> {
      if (!text || !this.apiKey) return null;

      try {
        const prompt = this.buildPrompt(text, existingCategories);
        const response = await this.callOpenAI(prompt);
        return this.parseResponse(response);
      } catch (error) {
        Logger.log('OpenAI categorization error: ' + error);
        return null;
      }
    }

    /**
     * Build prompt for OpenAI API.
     *
     * @param {string} text Document text.
     * @param {Query.Category[]} existingCategories Existing categories.
     * @return {string} Prompt text.
     */
    private buildPrompt(
      text: string,
      existingCategories: Query.Category[],
    ): string {
      const categoryNames = existingCategories
        .map((c) => c.name)
        .join(', ');

      return `You are a document categorization assistant. Analyze the following document text and suggest a category configuration.

Existing categories: ${categoryNames || 'None'}

Document text (first 500 chars):
${text.substring(0, 500)}

Please respond ONLY with a valid JSON object in this exact format (no additional text):
{
  "name": "Category Name",
  "path": "CategoryName/$y/$m",
  "conditions": ["keyword1", "keyword2"],
  "confidence": 0.95,
  "rename": "Document-$y-$m-$d.pdf"
}

Rules:
1. Use descriptive category names
2. Path must include $y for year
3. Conditions are keywords found in the document
4. Confidence is 0-1
5. Rename is optional, use date variables if needed`;
    }

    /* istanbul ignore next */
    /**
     * Call OpenAI API.
     *
     * @param {string} prompt Prompt text.
     * @return {Promise<string>} API response.
     */
    private async callOpenAI(prompt: string): Promise<string> {
      const url = 'https://api.openai.com/v1/chat/completions';
      const payload = {
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a document categorization assistant.',
          },
          {role: 'user', content: prompt},
        ],
        temperature: 0.3,
        max_tokens: 500,
      };

      const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();

      if (responseCode !== 200) {
        throw new Error(
          `OpenAI API error: ${responseCode} - ${response.getContentText()}`,
        );
      }

      const data = JSON.parse(response.getContentText());
      return data.choices[0].message.content;
    }

    /**
     * Parse OpenAI API response.
     *
     * @param {string} response API response text.
     * @return {SuggestedCategory | null} Parsed suggestion or null.
     */
    private parseResponse(response: string): SuggestedCategory | null {
      try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '');
        }

        const suggestion = JSON.parse(jsonStr);

        // Use validation function
        return validateCategorySuggestion(suggestion);
      } catch (error) {
        Logger.log('Failed to parse OpenAI response: ' + error);
        return null;
      }
    }
  }

  /**
   * Google Gemini service implementation.
   */
  export class GeminiService implements AIService {
    private apiKey: string;
    private model: string;

    /**
     * Constructor for Gemini service.
     *
     * @param {string} apiKey Gemini API key.
     * @param {string} model Model to use (default: gemini-1.5-flash).
     */
    constructor(apiKey: string, model: string = 'gemini-1.5-flash') {
      this.apiKey = apiKey;
      this.model = model;
    }

    /**
     * Suggest a category for the given text.
     *
     * @param {string} text Document text to analyze.
     * @param {Query.Category[]} existingCategories Existing categories for context.
     * @return {Promise<SuggestedCategory | null>} Suggested category or null.
     */
    async suggestCategory(
      text: string,
      existingCategories: Query.Category[],
    ): Promise<SuggestedCategory | null> {
      if (!text || !this.apiKey) return null;

      try {
        const prompt = this.buildPrompt(text, existingCategories);
        const response = await this.callGemini(prompt);
        return this.parseResponse(response);
      } catch (error) {
        Logger.log('Gemini categorization error: ' + error);
        return null;
      }
    }

    /**
     * Build prompt for Gemini API.
     *
     * @param {string} text Document text.
     * @param {Query.Category[]} existingCategories Existing categories.
     * @return {string} Prompt text.
     */
    private buildPrompt(
      text: string,
      existingCategories: Query.Category[],
    ): string {
      const categoryNames = existingCategories
        .map((c) => c.name)
        .join(', ');

      return `You are a document categorization assistant. Analyze the following document text and suggest a category configuration.

Existing categories: ${categoryNames || 'None'}

Document text (first 500 chars):
${text.substring(0, 500)}

Please respond ONLY with a valid JSON object in this exact format (no additional text):
{
  "name": "Category Name",
  "path": "CategoryName/$y/$m",
  "conditions": ["keyword1", "keyword2"],
  "confidence": 0.95,
  "rename": "Document-$y-$m-$d.pdf"
}

Rules:
1. Use descriptive category names
2. Path must include $y for year
3. Conditions are keywords found in the document
4. Confidence is 0-1
5. Rename is optional, use date variables if needed`;
    }

    /* istanbul ignore next */
    /**
     * Call Gemini API.
     *
     * @param {string} prompt Prompt text.
     * @return {Promise<string>} API response.
     */
    private async callGemini(prompt: string): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      };

      const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();

      if (responseCode !== 200) {
        throw new Error(
          `Gemini API error: ${responseCode} - ${response.getContentText()}`,
        );
      }

      const data = JSON.parse(response.getContentText());
      return data.candidates[0].content.parts[0].text;
    }

    /**
     * Parse Gemini API response.
     *
     * @param {string} response API response text.
     * @return {SuggestedCategory | null} Parsed suggestion or null.
     */
    private parseResponse(response: string): SuggestedCategory | null {
      try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = response.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```\n?/g, '');
        }

        const suggestion = JSON.parse(jsonStr);

        // Use validation function
        return validateCategorySuggestion(suggestion);
      } catch (error) {
        Logger.log('Failed to parse Gemini response: ' + error);
        return null;
      }
    }
  }

  /**
   * Creates an email body with AI category suggestion.
   *
   * @param {SuggestedCategory} suggestion Suggested category from AI.
   * @param {string} fileName Name of the file that needs categorization.
   * @return {object} Email body with JSON configuration.
   */
  export const createSuggestionEmail = (
    suggestion: SuggestedCategory,
    fileName: string,
  ): {subject: string; text: string; html: string} => {
    const jsonConfig = JSON.stringify(
      {
        name: suggestion.name,
        conditions: suggestion.conditions.map((c) => `or('${c}')`),
        path: suggestion.path,
        rename: suggestion.rename,
      },
      null,
      2,
    );

    const subject = `AI Category Suggestion: ${suggestion.name}`;

    const text = `A new category suggestion has been generated for the file: ${fileName}

Category Name: ${suggestion.name}
Confidence: ${(suggestion.confidence * 100).toFixed(1)}%

JSON Configuration for category array:
${jsonConfig}

To add this category to your configuration:
1. Copy the JSON configuration above
2. Replace the conditions strings with actual or() calls
3. Add it to your categories array

Example:
{
  name: "${suggestion.name}",
  conditions: [${suggestion.conditions.map((c) => `or("${c}")`).join(', ')}],
  path: "${suggestion.path}",${suggestion.rename ? `\n  rename: "${suggestion.rename}",` : ''}
}`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4285f4; color: white; padding: 10px; border-radius: 5px; }
    .content { padding: 20px; background: #f5f5f5; margin: 20px 0; border-radius: 5px; }
    .code-block { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 5px; overflow-x: auto; }
    pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
    .confidence { color: #0f9d58; font-weight: bold; }
    .instructions { background: #fff3cd; padding: 10px; border-left: 4px solid #ffc107; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🤖 AI Category Suggestion</h2>
    </div>
    <div class="content">
      <p>A new category suggestion has been generated for the file: <strong>${fileName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong></p>
      <p><strong>Category Name:</strong> ${suggestion.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      <p><strong>Confidence:</strong> <span class="confidence">${(suggestion.confidence * 100).toFixed(1)}%</span></p>
      
      <h3>JSON Configuration for category array:</h3>
      <div class="code-block">
        <pre>${jsonConfig.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
      </div>
      
      <div class="instructions">
        <h4>To add this category to your configuration:</h4>
        <ol>
          <li>Copy the JSON configuration above</li>
          <li>Replace the conditions strings with actual or() calls</li>
          <li>Add it to your categories array</li>
        </ol>
      </div>
      
      <h3>Example usage:</h3>
      <div class="code-block">
        <pre>{
  name: "${suggestion.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}",
  conditions: [${suggestion.conditions.map((c) => `or("${c.replace(/</g, '&lt;').replace(/>/g, '&gt;')}")`).join(', ')}],
  path: "${suggestion.path.replace(/</g, '&lt;').replace(/>/g, '&gt;')}",${suggestion.rename ? `\n  rename: "${suggestion.rename.replace(/</g, '&lt;').replace(/>/g, '&gt;')}",` : ''}
}</pre>
      </div>
    </div>
  </div>
</body>
</html>`;

    return {subject, text, html};
  };

  /**
   * Sends AI category suggestion via email.
   *
   * @param {AIConfig} config AI configuration with notification email.
   * @param {SuggestedCategory} suggestion Suggested category.
   * @param {string} fileName File name that needs categorization.
   * @return {void}
   */
  export const sendSuggestionEmail = (
    config: AIConfig,
    suggestion: SuggestedCategory,
    fileName: string,
  ): void => {
    if (!config.notificationEmail) {
      throw new Error('Notification email is required');
    }

    const email = createSuggestionEmail(suggestion, fileName);
    Helpers.sendEmail(
      config.notificationEmail,
      email.subject,
      email.text,
      email.html,
    );

    Logger.log(
      `Sent AI suggestion email for ${fileName} to ${config.notificationEmail}`,
    );
  };

  /**
   * Processes a document with AI if it doesn't match any existing categories.
   *
   * @param {string} text Document text.
   * @param {string} fileName File name.
   * @param {Query.Category[]} categories Existing categories.
   * @param {AIConfig} config AI configuration.
   * @param {AIRunState} runState Rate limiting and deduplication state.
   * @return {Promise<boolean>} True if AI was used and suggestion sent.
   */
  export const processUnmatchedDocument = async (
    text: string,
    fileName: string,
    categories: Query.Category[],
    config: AIConfig,
    runState?: AIRunState,
  ): Promise<boolean> => {
    if (!config.enabled) {
      return false;
    }

    const state = runState || new AIRunState();
    const maxCalls = config.maxAICallsPerRun || 10;

    // Check rate limit
    if (!state.canMakeAICall(maxCalls)) {
      Logger.log(
        `AI call limit reached (${maxCalls}). Skipping ${fileName}`,
      );
      return false;
    }

    // Check for duplicate document
    const fingerprint = state.createDocumentFingerprint(fileName, text);
    if (state.isDocumentProcessed(fingerprint)) {
      Logger.log(
        `Document ${fileName} already processed (duplicate detected). Skipping.`,
      );
      return false;
    }

    // Check for privacy-sensitive content
    if (containsPrivacySensitiveContent(text, config.privacyFilters)) {
      Logger.log(
        `Skipping AI categorization for ${fileName} - privacy-sensitive content detected`,
      );
      return false;
    }

    // Anonymize text before sending to AI
    const anonymizedText = anonymizeText(text, config.privacyFilters);

    // Dry-run mode: log what would be sent without calling AI
    if (config.dryRun) {
      Logger.log(`[DRY-RUN] Would process document: ${fileName}`);
      Logger.log(`[DRY-RUN] Privacy filters: ${JSON.stringify(config.privacyFilters || [])}`);
      Logger.log(`[DRY-RUN] Anonymized text (first 500 chars): ${anonymizedText.substring(0, 500)}`);
      Logger.log(`[DRY-RUN] Would send email to: ${config.notificationEmail}`);
      Logger.log(`[DRY-RUN] AI provider: ${config.provider}`);
      
      // Mock suggestion for dry-run
      const mockSuggestion: SuggestedCategory = {
        name: 'DryRun_Category',
        path: 'DryRun/$y/$m',
        conditions: ['keyword1', 'keyword2'],
        confidence: 0.9,
        rename: 'DryRun-$y-$m-$d.pdf',
      };
      
      const email = createSuggestionEmail(mockSuggestion, fileName);
      Logger.log(`[DRY-RUN] Email subject: ${email.subject}`);
      Logger.log(`[DRY-RUN] Email text (first 200 chars): ${email.text.substring(0, 200)}...`);
      
      state.markDocumentProcessed(fingerprint);
      state.incrementAICallCount();
      return true;
    }

    // Get AI service
    const service = createAIService(config);
    if (!service) {
      Logger.log('Failed to create AI service');
      return false;
    }

    // Increment call count before making the call
    state.incrementAICallCount();

    // Get suggestion
    const suggestion = await service.suggestCategory(
      anonymizedText,
      categories,
    );

    if (!suggestion) {
      Logger.log(`AI could not suggest a category for ${fileName}`);
      return false;
    }

    // Validate suggestion
    const validatedSuggestion = validateCategorySuggestion(suggestion);
    if (!validatedSuggestion) {
      Logger.log(`AI suggestion for ${fileName} failed validation`);
      return false;
    }

    // Mark document as processed
    state.markDocumentProcessed(fingerprint);

    // Send email with suggestion
    sendSuggestionEmail(config, validatedSuggestion, fileName);
    return true;
  };

  /**
   * Creates an AI service based on configuration.
   *
   * @param {AIConfig} config AI configuration.
   * @return {AIService | null} AI service instance or null.
   */
  export const createAIService = (config: AIConfig): AIService | null => {
    if (!config.enabled || !config.apiKey) {
      return null;
    }

    switch (config.provider) {
      case 'openai':
        return new OpenAIService(config.apiKey, config.model);
      case 'gemini':
        return new GeminiService(config.apiKey, config.model);
      default:
        return null;
    }
  };
}
