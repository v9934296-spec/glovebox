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
import { useAllServiceRecords, useReminders, useVehicles } from '@/lib/db/hooks';
import { dueSummary, reminderDueState, todayIso, type DueState } from '@/lib/domain/due';
import { healthScore } from '@/lib/domain/healthScore';
import type { Reminder, Vehicle } from '@/lib/domain/types';

const { width, height } = Dimensions.get('window');
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
      <View style={styles.room}>
        <View style={styles.slats}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.slat} />
          ))}
        </View>
        <View style={styles.emptyFloor}>
          <Text style={styles.bayPaint}>BAY 00</Text>
          <Text style={styles.emptyHint}>BAY EMPTY</Text>
          <Pressable onPress={() => router.push('/vehicle/add')} hitSlop={8}>
            <Text style={styles.pull}>PULL A CAR IN</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.room}>
      <FlatList
        data={sorted}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.vehicle.id}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const { vehicle, health, nextDue } = item;
          return (
            <Pressable
              style={{ width, height: height - 160 }}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: vehicle.id } })}
            >
              {vehicle.photoUri ? (
                <Image source={{ uri: vehicle.photoUri }} style={styles.photo} />
              ) : (
                <View style={styles.photoFallback}>
                  <View style={styles.slats}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <View key={i} style={styles.slat} />
                    ))}
                  </View>
                  <Text style={styles.fallbackYmm}>
                    {vehicle.year} {vehicle.make.toUpperCase()} {vehicle.model.toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.tag}>
                <Text style={styles.tagName}>{vehicle.nickname.toUpperCase()}</Text>
                <Text style={styles.tagMi}>{vehicle.mileage.toLocaleString()} MI</Text>
              </View>

              <View style={styles.floor}>
                <Text style={styles.bayPaint}>BAY {bayNo(index)}</Text>
                <Text style={styles.score}>{health.score}</Text>
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
        <View style={styles.dots}>
          {sorted.map((item, i) => (
            <View key={item.vehicle.id} style={[styles.dot, i === page && styles.dotOn]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  room: {
    flex: 1,
    backgroundColor: '#1A1916',
  },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '72%',
  },
  photoFallback: {
    height: '72%',
    backgroundColor: '#2A2926',
    justifyContent: 'flex-end',
  },
  slats: {
    paddingTop: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  slat: {
    height: 10,
    backgroundColor: '#6B665C',
  },
  fallbackYmm: {
    color: '#C9C2B4',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textAlign: 'center',
    paddingVertical: 16,
  },
  tag: {
    position: 'absolute',
    right: 16,
    top: '58%',
    backgroundColor: '#EFE6D2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1C1A16',
  },
  tagName: {
    color: '#1C1A16',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  tagMi: {
    color: '#4A463E',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
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
  bayPaint: {
    color: '#D7D0C4',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 3,
  },
  score: {
    color: '#D85A1A',
    fontSize: 40,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  due: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 8,
    color: '#8A847A',
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
    color: '#8A847A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pull: {
    color: '#D85A1A',
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
    backgroundColor: '#4A4741',
  },
  dotOn: {
    backgroundColor: '#EFE6D2',
  },
});
