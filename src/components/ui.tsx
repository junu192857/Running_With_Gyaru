import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { theme } from "../theme";

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  label,
  valueText,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
}: {
  label: string;
  valueText: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 줄이기`}
          disabled={decrementDisabled}
          onPress={onDecrement}
          style={[styles.stepperButton, decrementDisabled && styles.disabled]}
        >
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{valueText}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} 늘리기`}
          disabled={incrementDisabled}
          onPress={onIncrement}
          style={[styles.stepperButton, incrementDisabled && styles.disabled]}
        >
          <Text style={styles.stepperButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = "accent",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "accent" | "neutral" | "danger";
}) {
  const toneStyle =
    tone === "danger" ? styles.buttonDanger : tone === "neutral" ? styles.buttonNeutral : styles.buttonAccent;
  // 밝은 배경(accent) 위에서는 어두운 글자가, 어두운 배경(neutral) 위에서는 밝은 글자가 읽힌다
  const textStyle = tone === "neutral" ? styles.buttonTextLight : styles.buttonTextDark;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, toneStyle, disabled && styles.disabled]}
    >
      <Text style={[styles.buttonText, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function StatTile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    padding: theme.space,
    gap: 12,
  },
  sectionLabel: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: theme.surfaceAlt,
    borderRadius: theme.radius,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius - 4,
    alignItems: "center",
  },
  segmentSelected: { backgroundColor: theme.accent },
  segmentText: { color: theme.textMuted, fontWeight: "600" },
  segmentTextSelected: { color: "#1a0d14" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  stepperLabel: { color: theme.text, fontSize: 15, flexShrink: 1 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { color: theme.text, fontSize: 20, lineHeight: 22 },
  stepperValue: { color: theme.text, fontSize: 16, fontWeight: "700", minWidth: 84, textAlign: "center" },
  button: {
    paddingVertical: 16,
    borderRadius: theme.radius,
    alignItems: "center",
  },
  buttonAccent: { backgroundColor: theme.accent },
  buttonNeutral: { backgroundColor: theme.surfaceAlt },
  buttonDanger: { backgroundColor: theme.danger },
  buttonText: { fontSize: 16, fontWeight: "800" },
  buttonTextDark: { color: "#1a0d14" },
  buttonTextLight: { color: theme.text },
  disabled: { opacity: 0.4 },
  statTile: { flex: 1, gap: 4 },
  statLabel: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  statValue: { color: theme.text, fontSize: 26, fontWeight: "800" },
  statUnit: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
});
