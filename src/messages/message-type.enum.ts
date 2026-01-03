/**
 * Enum for different message types
 * This enables extensibility for future message types like anniversaries
 */
export enum MessageType {
  BIRTHDAY = 'birthday',
  ANNIVERSARY = 'anniversary',
  // Add more message types here as needed
}

/**
 * Message templates for different message types
 */
export const MESSAGE_TEMPLATES: Record<
  MessageType,
  (fullName: string) => string
> = {
  [MessageType.BIRTHDAY]: (fullName: string) =>
    `Hey, ${fullName} it's your birthday`,
  [MessageType.ANNIVERSARY]: (fullName: string) =>
    `Hey, ${fullName} happy work anniversary!`,
};

/**
 * Get the message content for a given type and user
 */
export function getMessageContent(type: MessageType, fullName: string): string {
  const template = MESSAGE_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown message type: ${type}`);
  }
  return template(fullName);
}
