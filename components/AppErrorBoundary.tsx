import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { reportFatalError } from '@/lib/errors';
import { palette, spacing, typography } from '@/lib/theme';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Catches render errors in the tree below so production does not die on a
 * white screen. "Restart" remounts children; it cannot recover event-handler
 * or native crashes (React error boundaries never see those).
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportFatalError(error, info.componentStack);
  }

  private restart = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error != null) {
      return <CrashFallback onRestart={this.restart} />;
    }
    return this.props.children;
  }
}

function CrashFallback({ onRestart }: { onRestart: () => void }) {
  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          Glovebox hit an unexpected error. Your data is still on this device. Restart to continue.
        </Text>
        <Button title="Restart" onPress={onRestart} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  body: { gap: spacing.lg },
  title: {
    color: palette.text.primary,
    fontSize: typography.h2.size,
    fontWeight: typography.h2.weight,
    lineHeight: typography.h2.lineHeight,
  },
  message: {
    color: palette.text.secondary,
    fontSize: typography.body.size,
    lineHeight: typography.body.lineHeight,
  },
});
