/**
 * useFormValidation Hook
 *
 * Manages validation state for form fields with real-time and on-blur modes.
 */
import { useState, useCallback } from 'react';
/**
 * Hook for managing form field validation state
 */
export function useFormValidation(initialValues, options = {}) {
    const { mode = 'onBlur', revalidateMode = 'onBlur' } = options;
    const [formState, setFormState] = useState(() => {
        const state = {};
        Object.keys(initialValues).forEach(key => {
            state[key] = {
                value: initialValues[key],
                errors: [],
                touched: false,
                isDirty: false,
            };
        });
        return state;
    });
    const setFieldValue = useCallback((fieldName, value) => {
        setFormState(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                value,
                isDirty: value !== initialValues[fieldName],
                ...(mode === 'onChange' && { touched: true }),
            },
        }));
    }, [mode, initialValues]);
    const setFieldError = useCallback((fieldName, errors) => {
        setFormState(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                errors,
            },
        }));
    }, []);
    const setFieldTouched = useCallback((fieldName, touched = true) => {
        setFormState(prev => ({
            ...prev,
            [fieldName]: {
                ...prev[fieldName],
                touched,
            },
        }));
    }, []);
    const validateField = useCallback((fieldName, validator) => {
        const result = validator(formState[fieldName]?.value);
        setFieldError(fieldName, result.errors);
        return result.valid;
    }, [formState, setFieldError]);
    const validateForm = useCallback((validators) => {
        let isFormValid = true;
        const newFormState = { ...formState };
        Object.keys(validators).forEach(fieldName => {
            const result = validators[fieldName](formState[fieldName]?.value);
            if (!result.valid) {
                isFormValid = false;
            }
            newFormState[fieldName] = {
                ...newFormState[fieldName],
                errors: result.errors,
            };
        });
        setFormState(newFormState);
        return isFormValid;
    }, [formState]);
    const reset = useCallback(() => {
        const state = {};
        Object.keys(initialValues).forEach(key => {
            state[key] = {
                value: initialValues[key],
                errors: [],
                touched: false,
                isDirty: false,
            };
        });
        setFormState(state);
    }, [initialValues]);
    const getFieldProps = useCallback((fieldName, validator) => ({
        value: formState[fieldName]?.value,
        onChange: (e) => {
            const value = e.target?.value !== undefined ? e.target.value : e;
            setFieldValue(fieldName, value);
            if (mode === 'onChange' && validator) {
                validateField(fieldName, validator);
            }
        },
        onBlur: (e) => {
            setFieldTouched(fieldName, true);
            if (validator && (mode === 'onBlur' || revalidateMode === 'onBlur')) {
                validateField(fieldName, validator);
            }
        },
    }), [formState, mode, revalidateMode, setFieldValue, setFieldTouched, validateField]);
    return {
        values: Object.keys(formState).reduce((acc, key) => {
            acc[key] = formState[key].value;
            return acc;
        }, {}),
        errors: Object.keys(formState).reduce((acc, key) => {
            acc[key] = formState[key].errors;
            return acc;
        }, {}),
        touched: Object.keys(formState).reduce((acc, key) => {
            acc[key] = formState[key].touched;
            return acc;
        }, {}),
        isDirty: Object.values(formState).some(field => field.isDirty),
        formState,
        setFieldValue,
        setFieldError,
        setFieldTouched,
        validateField,
        validateForm,
        reset,
        getFieldProps,
    };
}
/**
 * Hook for validating a single field
 */
export function useFieldValidation(initialValue, validator, options = {}) {
    const { mode = 'onBlur' } = options;
    const [value, setValue] = useState(initialValue);
    const [errors, setErrors] = useState([]);
    const [touched, setTouched] = useState(false);
    const validate = useCallback(() => {
        const result = validator(value);
        setErrors(result.errors);
        return result.valid;
    }, [value, validator]);
    const handleChange = useCallback((e) => {
        const newValue = e.target?.value !== undefined ? e.target.value : e;
        setValue(newValue);
        if (mode === 'onChange') {
            validate();
        }
    }, [mode, validate]);
    const handleBlur = useCallback(() => {
        setTouched(true);
        if (mode === 'onBlur') {
            validate();
        }
    }, [mode, validate]);
    return {
        value,
        setValue,
        errors,
        setErrors,
        touched,
        setTouched,
        validate,
        bind: {
            value,
            onChange: handleChange,
            onBlur: handleBlur,
        },
    };
}
/**
 * Hook for managing async validation (e.g., checking if name already exists)
 */
export function useAsyncFieldValidation(initialValue, asyncValidator, options = {}) {
    const { debounceMs = 300 } = options;
    const [value, setValue] = useState(initialValue);
    const [errors, setErrors] = useState([]);
    const [isValidating, setIsValidating] = useState(false);
    const [touched, setTouched] = useState(false);
    const handleChange = useCallback((e) => {
        const newValue = e.target?.value !== undefined ? e.target.value : e;
        setValue(newValue);
        setTouched(true);
        // Debounce async validation
        const timer = setTimeout(async () => {
            setIsValidating(true);
            try {
                const result = await asyncValidator(newValue);
                setErrors(result.errors);
            }
            catch (error) {
                setErrors([
                    {
                        field: 'field',
                        message: 'Validation failed',
                        code: 'ASYNC-001',
                    },
                ]);
            }
            finally {
                setIsValidating(false);
            }
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [asyncValidator, debounceMs]);
    return {
        value,
        setValue,
        errors,
        touched,
        isValidating,
        bind: {
            value,
            onChange: handleChange,
        },
    };
}
/**
 * Hook for combining multiple validators on a single field
 */
export function useCompositeValidation(initialValue, validators, options = {}) {
    const { mode = 'onBlur' } = options;
    const [value, setValue] = useState(initialValue);
    const [allErrors, setAllErrors] = useState([]);
    const [touched, setTouched] = useState(false);
    const validate = useCallback(() => {
        const errors = [];
        validators.forEach(validator => {
            const result = validator(value);
            if (!result.valid) {
                errors.push(...result.errors);
            }
        });
        setAllErrors(errors);
        return errors.length === 0;
    }, [value, validators]);
    const handleChange = useCallback((e) => {
        const newValue = e.target?.value !== undefined ? e.target.value : e;
        setValue(newValue);
        if (mode === 'onChange') {
            validate();
        }
    }, [mode, validate]);
    const handleBlur = useCallback(() => {
        setTouched(true);
        if (mode === 'onBlur') {
            validate();
        }
    }, [mode, validate]);
    return {
        value,
        setValue,
        errors: allErrors,
        touched,
        validate,
        bind: {
            value,
            onChange: handleChange,
            onBlur: handleBlur,
        },
    };
}
