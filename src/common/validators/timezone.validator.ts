import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import * as moment from 'moment-timezone';

/**
 * Custom validator to check if a timezone is a valid IANA timezone
 */
@ValidatorConstraint({ name: 'isIANATimezone', async: false })
export class IsIANATimezoneConstraint implements ValidatorConstraintInterface {
  private validTimezones: Set<string>;

  constructor() {
    // Cache the list of valid timezones for performance
    this.validTimezones = new Set(moment.tz.names());
  }

  validate(timezone: string): boolean {
    if (!timezone || typeof timezone !== 'string') {
      return false;
    }
    return this.validTimezones.has(timezone);
  }

  defaultMessage(): string {
    return 'timezone must be a valid IANA timezone (e.g., America/New_York, Asia/Jakarta, Australia/Melbourne)';
  }
}

/**
 * Decorator to validate IANA timezone
 * @param validationOptions Optional validation options
 */
export function IsIANATimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIANATimezoneConstraint,
    });
  };
}
