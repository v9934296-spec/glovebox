import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { Button, Chip, DueBadge, Field, HealthRing } from '../ui';
import { palette } from '../../lib/theme';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Circle: () => <View />,
  };
});

describe('shared UI refinements', () => {
  let timingSpy: jest.SpiedFunction<typeof Animated.timing>;

  beforeAll(() => {
    timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: (callback?: () => void) => callback?.(),
      stop: () => undefined,
      reset: () => undefined,
    } as unknown as Animated.CompositeAnimation);
  });

  afterAll(() => {
    timingSpy.mockRestore();
  });

  it('announces the health ring score for assistive tech', () => {
    const { getByLabelText } = render(<HealthRing score={82} />);
    expect(getByLabelText('Vehicle health 82 out of 100')).toBeTruthy();
  });

  it('renders an explicit validation message alongside field errors', () => {
    const { getByText } = render(
      <Field label="VIN" value="" onChangeText={() => {}} error="VIN is invalid" />,
    );
    expect(getByText('VIN')).toBeTruthy();
    expect(getByText('VIN is invalid')).toBeTruthy();
  });

  it('keeps due-state labels visible', () => {
    const { getByText } = render(<DueBadge state="due_soon" />);
    expect(getByText('Due soon')).toBeTruthy();
  });

  it('exposes chip selection through accessibility state', () => {
    const { UNSAFE_getByProps } = render(<Chip label="Truck" selected onPress={() => {}} />);
    expect(UNSAFE_getByProps({ accessibilityRole: 'button' }).props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('keeps loading buttons visually inactive even if pressed', () => {
    const { UNSAFE_getByProps } = render(<Button title="Save" onPress={() => {}} loading />);
    const pressable = UNSAFE_getByProps({ accessibilityRole: 'button' });
    const pressedStyle = StyleSheet.flatten(pressable.props.style({ pressed: true }));

    expect(pressable.props.disabled).toBe(true);
    expect(pressedStyle.backgroundColor).toBe(palette.accent.primary);
    expect(pressedStyle.opacity).toBe(0.5);
    expect(pressedStyle.transform).toBeUndefined();
  });

  it('keeps danger buttons transparent while still using the shared pressed treatment', () => {
    const { UNSAFE_getByProps } = render(<Button title="Delete" onPress={() => {}} variant="danger" />);
    const pressable = UNSAFE_getByProps({ accessibilityRole: 'button' });
    const pressedStyle = StyleSheet.flatten(pressable?.props.style({ pressed: true }));

    expect(pressedStyle.backgroundColor).toBe('transparent');
    expect(pressedStyle.opacity).toBe(0.92);
    expect(pressedStyle.transform).toEqual([{ scale: 0.99 }]);
  });
});
