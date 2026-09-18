import React from 'react';
import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { DueBadge, Field, HealthRing } from '../ui';

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
  beforeAll(() => {
    jest.spyOn(Animated, 'timing').mockReturnValue({
      start: (callback?: () => void) => callback?.(),
      stop: () => undefined,
      reset: () => undefined,
    } as unknown as Animated.CompositeAnimation);
  });

  it('announces the health ring score for assistive tech', () => {
    const { getByLabelText } = render(<HealthRing score={82} />);
    expect(getByLabelText('Vehicle health 82 out of 100')).toBeTruthy();
  });

  it('renders an explicit validation message alongside field errors', () => {
    const { getByLabelText, getByText } = render(
      <Field label="VIN" value="" onChangeText={() => {}} error="VIN is invalid" />,
    );
    expect(getByLabelText('VIN')).toBeTruthy();
    expect(getByText('VIN is invalid')).toBeTruthy();
  });

  it('keeps due-state labels visible', () => {
    const { getByText } = render(<DueBadge state="due_soon" />);
    expect(getByText('Due soon')).toBeTruthy();
  });
});
