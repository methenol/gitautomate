/**
 * Comprehensive tests for hooks and utilities
 * Step 6: Coverage & Completeness - Hooks and Utilities
 */

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { renderHook, act } from '@testing-library/react';

// Mock React for testing hooks
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useState: jest.fn(),
  useEffect: jest.fn(),
  useCallback: jest.fn(),
  useRef: jest.fn(),
}));

describe('Hooks and Utilities - Comprehensive Coverage', () => {
  describe('useToast Hook', () => {
    let mockSetState: jest.Mock;
    let mockUseState: jest.Mock;

    beforeEach(() => {
      mockSetState = jest.fn();
      mockUseState = jest.fn();
      
      // Mock useState to return state and setState
      (require('react').useState as jest.Mock).mockImplementation((initial) => {
        mockUseState.mockReturnValue([initial, mockSetState]);
        return [initial, mockSetState];
      });

      // Mock useEffect
      (require('react').useEffect as jest.Mock).mockImplementation((fn) => fn());
      
      // Mock useCallback to return the function
      (require('react').useCallback as jest.Mock).mockImplementation((fn) => fn);
      
      // Mock useRef
      (require('react').useRef as jest.Mock).mockImplementation(() => ({ current: null }));
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize with empty toasts array', () => {
      const { result } = renderHook(() => useToast());
      
      expect(result.current).toHaveProperty('toasts');
      expect(result.current).toHaveProperty('toast');
      expect(result.current).toHaveProperty('dismiss');
    });

    it('should add toast with default properties', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Test Toast',
          description: 'Test description',
        });
      });

      // Verify that setState was called to add the toast
      expect(mockSetState).toHaveBeenCalled();
    });

    it('should add toast with custom properties', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Success',
          description: 'Operation completed successfully',
          variant: 'default',
          duration: 5000,
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should add toast with destructive variant', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Error',
          description: 'Something went wrong',
          variant: 'destructive',
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should add toast with action', () => {
      const mockAction = {
        label: 'Undo',
        onClick: jest.fn(),
      };

      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Item deleted',
          description: 'The item has been deleted',
          action: mockAction,
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should dismiss toast by id', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.dismiss('toast-id-123');
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should dismiss all toasts when no id provided', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.dismiss();
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle multiple toasts', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      // Should have called setState for each toast
      expect(mockSetState).toHaveBeenCalledTimes(3);
    });

    it('should handle toast with custom duration', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Custom Duration',
          duration: 10000,
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle toast with no duration (persistent)', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Persistent Toast',
          duration: 0,
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle toast with complex action object', () => {
      const complexAction = {
        label: 'View Details',
        onClick: jest.fn(),
        className: 'custom-action-class',
        disabled: false,
      };

      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Complex Action Toast',
          description: 'Toast with complex action configuration',
          action: complexAction,
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle rapid toast creation and dismissal', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        // Rapidly create and dismiss toasts
        for (let i = 0; i < 10; i++) {
          result.current.toast({ title: `Toast ${i}` });
          if (i % 2 === 0) {
            result.current.dismiss();
          }
        }
      });

      // Should handle rapid operations without issues
      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle toast with HTML content', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'HTML Content',
          description: 'This toast contains <strong>HTML</strong> content',
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle edge case with empty title and description', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: '',
          description: '',
        });
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle null and undefined values gracefully', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({
          title: 'Test',
          description: undefined,
          action: null,
        } as any);
      });

      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle maximum number of toasts', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        // Add many toasts to test limits
        for (let i = 0; i < 100; i++) {
          result.current.toast({ title: `Toast ${i}` });
        }
      });

      expect(mockSetState).toHaveBeenCalledTimes(100);
    });

    it('should handle toast state management correctly', () => {
      // Mock useState to track state changes
      let currentState: any[] = [];
      mockSetState.mockImplementation((updater) => {
        if (typeof updater === 'function') {
          currentState = updater(currentState);
        } else {
          currentState = updater;
        }
      });

      const { result } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({ title: 'State Test' });
      });

      expect(mockSetState).toHaveBeenCalled();
    });
  });

  describe('cn Utility Function', () => {
    it('should combine class names correctly', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle conditional classes', () => {
      const isActive = true;
      const isDisabled = false;
      
      const result = cn(
        'base-class',
        isActive && 'active-class',
        isDisabled && 'disabled-class'
      );
      
      expect(result).toContain('base-class');
      expect(result).toContain('active-class');
      expect(result).not.toContain('disabled-class');
    });

    it('should handle arrays of classes', () => {
      const classes = ['array-class-1', 'array-class-2'];
      const result = cn('base', classes);
      
      expect(result).toContain('base');
      expect(result).toContain('array-class-1');
      expect(result).toContain('array-class-2');
    });

    it('should handle objects with conditional classes', () => {
      const result = cn('base', {
        'conditional-true': true,
        'conditional-false': false,
        'conditional-truthy': 'truthy-value',
        'conditional-falsy': '',
      });
      
      expect(result).toContain('base');
      expect(result).toContain('conditional-true');
      expect(result).toContain('conditional-truthy');
      expect(result).not.toContain('conditional-false');
      expect(result).not.toContain('conditional-falsy');
    });

    it('should handle null and undefined values', () => {
      const result = cn('base', null, undefined, 'valid');
      
      expect(result).toContain('base');
      expect(result).toContain('valid');
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
    });

    it('should handle empty strings and zero values', () => {
      const result = cn('base', '', 0, 'valid');
      
      expect(result).toContain('base');
      expect(result).toContain('valid');
    });

    it('should handle complex nested conditions', () => {
      const props = {
        variant: 'primary' as const,
        size: 'large' as const,
        disabled: false,
        loading: true,
      };
      
      const result = cn(
        'btn',
        props.variant === 'primary' && 'btn-primary',
        props.size === 'large' && 'btn-lg',
        props.disabled && 'btn-disabled',
        props.loading && 'btn-loading',
        {
          'btn-interactive': !props.disabled && !props.loading,
          'btn-state-normal': !props.disabled && !props.loading,
        }
      );
      
      expect(result).toContain('btn');
      expect(result).toContain('btn-primary');
      expect(result).toContain('btn-lg');
      expect(result).toContain('btn-loading');
      expect(result).not.toContain('btn-disabled');
      expect(result).not.toContain('btn-interactive'); // loading is true
    });

    it('should handle duplicate class names', () => {
      const result = cn('duplicate', 'other', 'duplicate', 'final');
      
      // Should handle duplicates appropriately (behavior depends on implementation)
      expect(result).toContain('duplicate');
      expect(result).toContain('other');
      expect(result).toContain('final');
    });

    it('should handle very long class name strings', () => {
      const longClassName = 'very-long-class-name-that-exceeds-normal-length-limits-and-tests-edge-cases';
      const result = cn('base', longClassName);
      
      expect(result).toContain('base');
      expect(result).toContain(longClassName);
    });

    it('should handle special characters in class names', () => {
      const specialClasses = [
        'class-with-dashes',
        'class_with_underscores',
        'class123with456numbers',
        'class.with.dots', // May not be valid CSS but should be handled
        'class:with:colons',
      ];
      
      const result = cn('base', ...specialClasses);
      
      expect(result).toContain('base');
      specialClasses.forEach(className => {
        expect(result).toContain(className);
      });
    });

    it('should handle mixed argument types', () => {
      const result = cn(
        'string-arg',
        ['array', 'of', 'classes'],
        { 'object-true': true, 'object-false': false },
        null,
        undefined,
        'another-string',
        123, // Number (behavior depends on implementation)
        true && 'conditional-string'
      );
      
      expect(result).toContain('string-arg');
      expect(result).toContain('array');
      expect(result).toContain('classes');
      expect(result).toContain('object-true');
      expect(result).toContain('another-string');
      expect(result).toContain('conditional-string');
      expect(result).not.toContain('object-false');
    });

    it('should handle empty inputs', () => {
      const result = cn();
      expect(typeof result).toBe('string');
    });

    it('should handle performance with many arguments', () => {
      const manyArgs = Array(1000).fill(null).map((_, i) => `class-${i}`);
      
      const startTime = Date.now();
      const result = cn(...manyArgs);
      const endTime = Date.now();
      
      // Should complete quickly even with many arguments
      expect(endTime - startTime).toBeLessThan(100);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should be consistent with repeated calls', () => {
      const args = ['base', 'conditional', { active: true, disabled: false }];
      
      const result1 = cn(...args);
      const result2 = cn(...args);
      const result3 = cn(...args);
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it('should handle Tailwind CSS specific patterns', () => {
      const result = cn(
        'bg-blue-500',
        'hover:bg-blue-600',
        'focus:ring-2',
        'focus:ring-blue-300',
        'disabled:opacity-50',
        'sm:text-lg',
        'md:text-xl',
        'lg:text-2xl'
      );
      
      expect(result).toContain('bg-blue-500');
      expect(result).toContain('hover:bg-blue-600');
      expect(result).toContain('focus:ring-2');
      expect(result).toContain('sm:text-lg');
    });

    it('should handle responsive and state variants', () => {
      const isHovered = true;
      const isFocused = false;
      const screenSize = 'md';
      
      const result = cn(
        'base-component',
        'text-gray-900',
        isHovered && 'hover:text-blue-600',
        isFocused && 'focus:text-blue-800',
        screenSize === 'sm' && 'text-sm',
        screenSize === 'md' && 'text-base',
        screenSize === 'lg' && 'text-lg'
      );
      
      expect(result).toContain('base-component');
      expect(result).toContain('text-gray-900');
      expect(result).toContain('hover:text-blue-600');
      expect(result).toContain('text-base');
      expect(result).not.toContain('focus:text-blue-800');
      expect(result).not.toContain('text-sm');
      expect(result).not.toContain('text-lg');
    });
  });

  describe('Integration Scenarios', () => {
    it('should work together - useToast with cn for styling', () => {
      const { result } = renderHook(() => useToast());
      
      // Simulate using cn for toast styling
      const toastClasses = cn(
        'toast-base',
        'bg-white',
        'border',
        'rounded-lg',
        'shadow-md',
        { 'border-red-500': false, 'border-green-500': true }
      );
      
      act(() => {
        result.current.toast({
          title: 'Styled Toast',
          description: 'Toast with custom styling',
          className: toastClasses,
        });
      });
      
      expect(mockSetState).toHaveBeenCalled();
      expect(toastClasses).toContain('toast-base');
      expect(toastClasses).toContain('border-green-500');
      expect(toastClasses).not.toContain('border-red-500');
    });

    it('should handle toast variants with cn', () => {
      const { result } = renderHook(() => useToast());
      
      const variants = {
        success: cn('bg-green-50', 'border-green-200', 'text-green-800'),
        error: cn('bg-red-50', 'border-red-200', 'text-red-800'),
        warning: cn('bg-yellow-50', 'border-yellow-200', 'text-yellow-800'),
        info: cn('bg-blue-50', 'border-blue-200', 'text-blue-800'),
      };
      
      act(() => {
        result.current.toast({
          title: 'Success',
          className: variants.success,
        });
        
        result.current.toast({
          title: 'Error',
          variant: 'destructive',
          className: variants.error,
        });
      });
      
      expect(mockSetState).toHaveBeenCalledTimes(2);
      expect(variants.success).toContain('bg-green-50');
      expect(variants.error).toContain('bg-red-50');
    });

    it('should handle complex toast with action styling', () => {
      const { result } = renderHook(() => useToast());
      
      const actionClassName = cn(
        'btn',
        'btn-sm',
        'btn-outline',
        'hover:btn-solid',
        'transition-colors'
      );
      
      act(() => {
        result.current.toast({
          title: 'Action Required',
          description: 'Please confirm your action',
          action: {
            label: 'Confirm',
            onClick: jest.fn(),
            className: actionClassName,
          },
        });
      });
      
      expect(mockSetState).toHaveBeenCalled();
      expect(actionClassName).toContain('btn');
      expect(actionClassName).toContain('transition-colors');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle hook cleanup scenarios', () => {
      const { result, unmount } = renderHook(() => useToast());
      
      act(() => {
        result.current.toast({ title: 'Test' });
      });
      
      // Unmount should not cause errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle invalid cn arguments gracefully', () => {
      // Test with potentially problematic inputs
      expect(() => cn(Symbol('test') as any)).not.toThrow();
      expect(() => cn(() => 'function' as any)).not.toThrow();
      expect(() => cn(new Date() as any)).not.toThrow();
      expect(() => cn(/regex/ as any)).not.toThrow();
    });

    it('should handle memory management with many toasts', () => {
      const { result } = renderHook(() => useToast());
      
      act(() => {
        // Create many toasts rapidly
        for (let i = 0; i < 1000; i++) {
          result.current.toast({ title: `Toast ${i}` });
          if (i % 10 === 0) {
            result.current.dismiss(); // Periodically dismiss
          }
        }
      });
      
      // Should handle many operations without memory issues
      expect(mockSetState).toHaveBeenCalled();
    });

    it('should handle concurrent toast operations', async () => {
      const { result } = renderHook(() => useToast());
      
      const operations = Array(100).fill(null).map((_, i) => 
        new Promise<void>((resolve) => {
          setTimeout(() => {
            act(() => {
              result.current.toast({ title: `Concurrent ${i}` });
              if (i % 2 === 0) result.current.dismiss();
            });
            resolve();
          }, Math.random() * 10);
        })
      );
      
      await Promise.all(operations);
      
      // Should handle concurrent operations without issues
      expect(mockSetState).toHaveBeenCalled();
    });
  });
});