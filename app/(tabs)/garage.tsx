import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BayPaint, BayRoom, BayScore, HangTag, Slats } from '@/components/bay';
import { bay } from '@/lib/bay';
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { healthScore } from '@/lib/domain/healthScore';
import type { Reminder, Vehicle } from '@/lib/domain/types';

const { width } = Dimensions.get('window');
const DUE_RANK: Record<DueState, number> = { overdue: 0, due_soon: 1, upcoming: 2, no_due: 3 };

function nextDueFor(vehicle: Vehicle, reminders: Reminder[], today: string) {
  let best: { title: string; summary: string; state: DueState } | null = null;
  for (const r of reminders) {
    const state = reminderDueState(r, vehicle.mileage, today);
    if (state === 'no_due') continue;
    if (!best || DUE_RANK[state] < DUE_RANK[best.state]) {
      best = {
        title: r.title,
        state,
        summary: dueSummary({
          dueDate: r.dueDate,
          dueMileage: r.dueMileage,
          currentMileage: vehicle.mileage,
          today,
        }),
      };
    }
  }
  return best;
}

function bayNo(i: number) {
  return String(i + 1).padStart(2, '0');
}

export default function GarageScreen() {
  const vehicles = useVehicles();
  const allRecords = useAllServiceRecords();
  const activeReminders = useReminders({ status: 'active' });
  const router = useRouter();
  const today = todayIso();
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const enriched = vehicles.map((vehicle) => {
      const reminders = activeReminders.filter((r) => r.vehicleId === vehicle.id);
      const records = allRecords.filter((r) => r.vehicleId === vehicle.id);
      const health = healthScore({ vehicle, records, reminders, today });
      const nextDue = nextDueFor(vehicle, reminders, today);
      const sortKey = nextDue ? DUE_RANK[nextDue.state] : 4;
      return { vehicle, health, nextDue, sortKey };
    });
    return enriched.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.vehicle.nickname.localeCompare(b.vehicle.nickname);
    });
  }, [vehicles, activeReminders, allRecords, today]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) setPage(i);
  }

  if (vehicles.length === 0) {
    return (
      <BayRoom>
        <Slats count={8} />
        <View style={styles.emptyFloor}>
          <BayPaint>BAY 00</BayPaint>
          <Text style={styles.emptyHint}>BAY EMPTY</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pull a car in"
            onPress={() => router.push('/vehicle/add')}
            hitSlop={8}
          >
            <Text style={styles.pull}>PULL A CAR IN</Text>
          </Pressable>
        </View>
      </BayRoom>
    );
  }

  return (
    <BayRoom>
      <FlatList
        style={{ flex: 1 }}
        data={sorted}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.vehicle.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const { vehicle, health, nextDue } = item;
          const label = [
            vehicle.nickname,
            `${vehicle.mileage.toLocaleString()} miles`,
            nextDue ? `${nextDue.title}, ${nextDue.summary}` : `health ${health.score}`,
          ].join(', ');
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{ width, flex: 1 }}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
            >
              {vehicle.photoUri ? (
                <Image source={{ uri: vehicle.photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoFallback}>
                  <Slats count={6} />
                  <Text style={styles.fallbackYmm}>
                    {vehicle.year} {vehicle.make.toUpperCase()} {vehicle.model.toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.tagWrap}>
                <HangTag name={vehicle.nickname} miles={`${vehicle.mileage.toLocaleString()} MI`} />
              </View>

              <View style={styles.floor}>
                <BayPaint>{`BAY ${bayNo(index)}`}</BayPaint>
                <BayScore score={health.score} />
              </View>

              {nextDue != null && (
                <Text style={styles.due}>
                  {nextDue.title.toUpperCase()}  ·  {nextDue.summary.toUpperCase()}
                </Text>
              )}
            </Pressable>
          );
        }}
      />

      {sorted.length > 1 && (
        <View style={styles.dots} accessibilityRole="adjustable" accessibilityLabel={`Bay ${page + 1} of ${sorted.length}`}>
          {sorted.map((item, i) => (
            <View key={item.vehicle.id} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      )}
    </BayRoom>
  );
}

const styles = StyleSheet.create({
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '72%',
  },
  photoFallback: {
    height: '72%',
    backgroundColor: bay.fallback,
    justifyContent: 'flex-end',
  },
  fallbackYmm: {
    color: bay.ymm,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    paddingVertical: 16,
  },
  tagWrap: {
    position: 'absolute',
    right: 16,
    top: '58%',
  },
  floor: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  due: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 8,
    color: bay.due,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  emptyFloor: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyHint: {
    color: bay.hint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pull: {
    color: bay.orange,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.6,
    textDecorationLine: 'underline',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    paddingBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    backgroundColor: bay.dot,
  },
  dotOn: {
    backgroundColor: bay.cream,
  },
});
