import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@wl_tracker_data_v3';
const DOUBLE_TAP_DELAY = 300; // ms threshold for double tap/click

// Helper to format date keys like "YYYY-MM-DD"
const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Friendly date label
const getFriendlyDateLabel = (dateKey) => {
  const todayStr = formatDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = formatDateKey(yesterdayDate);

  if (dateKey === todayStr) return 'Today';
  if (dateKey === yesterdayStr) return 'Yesterday';

  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

// Normalize entry item
const normalizeItem = (item) => {
  if (typeof item === 'string') {
    return { type: item, note: '' };
  }
  return { type: item.type || 'W', note: item.note || '' };
};

export default function App() {
  const [data, setData] = useState({});
  const [activeMenuDate, setActiveMenuDate] = useState(null); // Date key for row edit modal
  
  // Badge Action Modal State: { dateKey, index, type, note }
  const [badgeModal, setBadgeModal] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInputText, setNoteInputText] = useState('');

  // Double tap tracking refs
  const lastWTapRef = useRef(0);
  const lastLTapRef = useRef(0);

  // Load saved data on startup
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue !== null) {
        setData(JSON.parse(jsonValue));
      } else {
        const todayStr = formatDateKey(new Date());
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = formatDateKey(yesterdayDate);

        const initialData = {
          [todayStr]: [
            { type: 'W', note: 'Chess victory' },
            { type: 'W', note: '' },
            { type: 'L', note: 'Ranked match' },
            { type: 'W', note: '' },
          ],
          [yesterdayStr]: [
            { type: 'W', note: '' },
            { type: 'W', note: '' },
            { type: 'W', note: '' },
            { type: 'L', note: '' },
            { type: 'W', note: '' },
          ],
        };
        setData(initialData);
        saveDataToStorage(initialData);
      }
    } catch (e) {
      console.error('Failed to load W/L data:', e);
    }
  };

  const saveDataToStorage = async (newData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    } catch (e) {
      console.error('Failed to save W/L data:', e);
    }
  };

  const updateData = (newData) => {
    setData(newData);
    saveDataToStorage(newData);
  };

  // Today key
  const todayKey = formatDateKey(new Date());

  // Append W or L to a specific day
  const handleAddEntry = (dateKey, type) => {
    const currentStack = data[dateKey] || [];
    const updatedStack = [...currentStack, { type, note: '' }];
    const newData = {
      ...data,
      [dateKey]: updatedStack,
    };
    updateData(newData);
  };

  // Double Click / Double Tap handler for Top Global Buttons
  const handleTopButtonDoublePress = (type) => {
    const now = Date.now();
    const lastTapRef = type === 'W' ? lastWTapRef : lastLTapRef;
    const delta = now - lastTapRef.current;

    if (delta < DOUBLE_TAP_DELAY) {
      handleAddEntry(todayKey, type);
      lastTapRef.current = 0; // reset
    } else {
      lastTapRef.current = now;
    }
  };

  // Open Badge Options Modal on Click
  const handleBadgeClick = (dateKey, index, item) => {
    const norm = normalizeItem(item);
    setBadgeModal({
      dateKey,
      index,
      type: norm.type,
      note: norm.note,
    });
    setIsEditingNote(false);
    setNoteInputText(norm.note);
  };

  // Remove Entry
  const handleRemoveBadge = () => {
    if (!badgeModal) return;
    const { dateKey, index } = badgeModal;
    const currentStack = data[dateKey] || [];
    const updatedStack = currentStack.filter((_, i) => i !== index);
    updateData({
      ...data,
      [dateKey]: updatedStack,
    });
    setBadgeModal(null);
  };

  // Toggle to Opposite Type (W <-> L)
  const handleToggleBadgeType = () => {
    if (!badgeModal) return;
    const { dateKey, index, type, note } = badgeModal;
    const newType = type === 'W' ? 'L' : 'W';

    const currentStack = data[dateKey] || [];
    const updatedStack = currentStack.map((item, i) => {
      if (i === index) {
        return { type: newType, note };
      }
      return item;
    });

    updateData({
      ...data,
      [dateKey]: updatedStack,
    });
    setBadgeModal({ ...badgeModal, type: newType });
  };

  // Save Note
  const handleSaveNote = () => {
    if (!badgeModal) return;
    const { dateKey, index, type } = badgeModal;

    const currentStack = data[dateKey] || [];
    const updatedStack = currentStack.map((item, i) => {
      if (i === index) {
        return { type, note: noteInputText };
      }
      return item;
    });

    updateData({
      ...data,
      [dateKey]: updatedStack,
    });
    setBadgeModal({ ...badgeModal, note: noteInputText });
    setIsEditingNote(false);
  };

  // Clear specific row stack
  const handleClearRow = (dateKey) => {
    updateData({
      ...data,
      [dateKey]: [],
    });
  };

  // Completely remove a day row from data
  const handleRemoveDay = (dateKey) => {
    const newData = { ...data };
    delete newData[dateKey];
    updateData(newData);
    setActiveMenuDate(null);
  };

  // Add earlier day
  const handleAddPreviousDay = () => {
    const sortedKeys = Object.keys(data).sort().reverse();
    let oldestDate = new Date();
    if (sortedKeys.length > 0) {
      const [y, m, d] = sortedKeys[sortedKeys.length - 1].split('-').map(Number);
      oldestDate = new Date(y, m - 1, d);
    }
    oldestDate.setDate(oldestDate.getDate() - 1);
    const prevKey = formatDateKey(oldestDate);

    if (!data[prevKey]) {
      updateData({ ...data, [prevKey]: [] });
    }
  };

  // Calculate Statistics
  const calculateWinStreak = () => {
    const sortedKeys = Object.keys(data).sort().reverse();
    let streak = 0;
    let ended = false;

    for (const key of sortedKeys) {
      const stack = data[key] || [];
      for (let i = stack.length - 1; i >= 0; i--) {
        const norm = normalizeItem(stack[i]);
        if (norm.type === 'W') {
          streak++;
        } else {
          ended = true;
          break;
        }
      }
      if (ended) break;
    }
    return streak;
  };

  const todayStack = data[todayKey] || [];
  const todayW = todayStack.map(normalizeItem).filter((x) => x.type === 'W').length;
  const todayL = todayStack.map(normalizeItem).filter((x) => x.type === 'L').length;
  const todayTotal = todayW + todayL;
  const todayWinRate = todayTotal > 0 ? Math.round((todayW / todayTotal) * 100) : 0;

  const currentStreak = calculateWinStreak();
  const dateKeys = Array.from(new Set([todayKey, ...Object.keys(data)])).sort().reverse();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>W/L Tracker</Text>
          <Text style={styles.appSubtitle}>Daily Win & Loss Records</Text>
        </View>

        {/* Global Action Buttons at Top (Double-click to append to Today) */}
        <View style={styles.globalActionsCard}>
          <Text style={styles.globalActionsLabel}>Log for Today (Double Click)</Text>
          <View style={styles.globalButtonRow}>
            <TouchableOpacity
              style={[styles.globalBtn, styles.globalBtnW]}
              onPress={() => handleTopButtonDoublePress('W')}
              activeOpacity={0.6}
            >
              <Text style={styles.globalBtnText}>+ W</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.globalBtn, styles.globalBtnL]}
              onPress={() => handleTopButtonDoublePress('L')}
              activeOpacity={0.6}
            >
              <Text style={styles.globalBtnText}>+ L</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stat Bar */}
        <View style={styles.statsCard}>
          <View style={styles.statBox}>
            <Text style={styles.statNumberOrange}>🔥 {currentStreak}W</Text>
            <Text style={styles.statLabel}>Win Streak</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statNumberBlue}>{todayWinRate}%</Text>
            <Text style={styles.statLabel}>Today's Rate</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statRatioText}>
              <Text style={{ color: '#10B981' }}>{todayW}</Text>
              <Text style={{ color: '#94A3B8' }}> / </Text>
              <Text style={{ color: '#EF4444' }}>{todayL}</Text>
            </Text>
            <Text style={styles.statLabel}>Today (W/L)</Text>
          </View>
        </View>

        {/* List of Daily Rows */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {dateKeys.map((dateKey) => {
            const rawStack = data[dateKey] || [];
            const stack = rawStack.map(normalizeItem);
            const dayW = stack.filter((x) => x.type === 'W').length;
            const dayL = stack.filter((x) => x.type === 'L').length;

            return (
              <TouchableOpacity
                key={dateKey}
                style={styles.dayRowCard}
                onLongPress={() => setActiveMenuDate(dateKey)}
                activeOpacity={0.9}
              >
                {/* Row Header Info */}
                <View style={styles.rowHeader}>
                  <View style={styles.rowTitleGroup}>
                    <Text style={styles.rowDateText}>{getFriendlyDateLabel(dateKey)}</Text>
                    <Text style={styles.rowSubDate}>{dateKey}</Text>
                  </View>
                  <View style={styles.dayCountBadge}>
                    <Text style={styles.dayCountText}>
                      <Text style={{ color: '#10B981', fontWeight: '700' }}>{dayW}W</Text> - {' '}
                      <Text style={{ color: '#EF4444', fontWeight: '700' }}>{dayL}L</Text>
                    </Text>
                  </View>
                </View>

                {/* Stack of Badges (Click badge opens action window) */}
                <View style={styles.stackContainer}>
                  {stack.length === 0 ? (
                    <Text style={styles.emptyStackText}>Tap badge to edit • Hold row for menu</Text>
                  ) : (
                    stack.map((normItem, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.badge,
                          normItem.type === 'W' ? styles.badgeW : styles.badgeL,
                        ]}
                        onPress={() => handleBadgeClick(dateKey, idx, normItem)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.badgeText}>{normItem.type}</Text>
                        {normItem.note !== '' && <View style={styles.noteIndicator} />}
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={handleAddPreviousDay}
            activeOpacity={0.7}
          >
            <Text style={styles.footerBtnText}>+ Add Earlier Day</Text>
          </TouchableOpacity>
        </View>

        {/* Badge Action Window Modal (Triggered on Badge Click) */}
        <Modal
          visible={badgeModal !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setBadgeModal(null)}
        >
          <TouchableWithoutFeedback onPress={() => setBadgeModal(null)}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingContainer}
              >
                <TouchableWithoutFeedback>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>Badge Details</Text>
                    <Text style={styles.modalSubTitle}>
                      {badgeModal?.dateKey ? getFriendlyDateLabel(badgeModal.dateKey) : ''}
                    </Text>

                    {/* Elegant Hero Display Card (Full Width) */}
                    <View
                      style={[
                        styles.badgeHeroCard,
                        badgeModal?.type === 'W' ? styles.badgeHeroCardW : styles.badgeHeroCardL,
                      ]}
                    >
                      <View
                        style={[
                          styles.badgeTypePill,
                          badgeModal?.type === 'W' ? styles.badgeTypePillW : styles.badgeTypePillL,
                        ]}
                      >
                        <Text style={styles.badgeTypePillText}>
                          {badgeModal?.type === 'W' ? '🟢 WIN' : '🔴 LOSS'}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.badgeHeroBodyText,
                          badgeModal?.type === 'W' ? styles.badgeHeroBodyTextW : styles.badgeHeroBodyTextL,
                        ]}
                      >
                        {badgeModal?.note ? `"${badgeModal.note}"` : badgeModal?.type === 'W' ? 'Win' : 'Loss'}
                      </Text>
                    </View>

                    {/* Inline Note Editing Section */}
                    {isEditingNote ? (
                      <View style={styles.noteInputContainer}>
                        <TextInput
                          style={styles.noteTextInput}
                          placeholder="Add a note (e.g. Chess, Valorant)..."
                          placeholderTextColor="#94A3B8"
                          value={noteInputText}
                          onChangeText={setNoteInputText}
                          autoFocus
                        />
                        <View style={styles.noteSaveRow}>
                          <TouchableOpacity
                            style={[styles.modalBtnCompact, styles.modalBtnW, { flex: 1 }]}
                            onPress={handleSaveNote}
                          >
                            <Text style={styles.modalBtnText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.modalBtnCompact, styles.modalBtnCancel, { flex: 1 }]}
                            onPress={() => setIsEditingNote(false)}
                          >
                            <Text style={styles.modalBtnCancelText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.badgeActionList}>
                        {/* 1. Edit / Add Note */}
                        <TouchableOpacity
                          style={[styles.modalBtnCompact, styles.modalBtnNote]}
                          onPress={() => setIsEditingNote(true)}
                        >
                          <Text style={styles.modalBtnNoteText}>
                            📝 {badgeModal?.note ? 'Edit Note' : 'Add Note'}
                          </Text>
                        </TouchableOpacity>

                        {/* 2. Switch to Opposite (W <-> L) */}
                        <TouchableOpacity
                          style={[
                            styles.modalBtnCompact,
                            badgeModal?.type === 'W' ? styles.modalBtnL : styles.modalBtnW,
                          ]}
                          onPress={handleToggleBadgeType}
                        >
                          <Text style={styles.modalBtnText}>
                            🔄 Switch to {badgeModal?.type === 'W' ? 'Loss (L)' : 'Win (W)'}
                          </Text>
                        </TouchableOpacity>

                        {/* 3. Remove Entry */}
                        <TouchableOpacity
                          style={[styles.modalBtnCompact, styles.modalBtnClear]}
                          onPress={handleRemoveBadge}
                        >
                          <Text style={styles.modalBtnClearText}>🗑️ Remove Entry</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!isEditingNote && (
                      <TouchableOpacity
                        style={[styles.modalBtnCompact, styles.modalBtnCancel, { marginTop: 10 }]}
                        onPress={() => setBadgeModal(null)}
                      >
                        <Text style={styles.modalBtnCancelText}>Close</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Day Menu Modal (Triggered on Row Long Press) */}
        <Modal
          visible={activeMenuDate !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setActiveMenuDate(null)}
        >
          <TouchableWithoutFeedback onPress={() => setActiveMenuDate(null)}>
            <View style={styles.modalOverlay}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingContainer}
              >
                <TouchableWithoutFeedback>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>
                      {activeMenuDate ? getFriendlyDateLabel(activeMenuDate) : ''}
                    </Text>

                    {/* Half-width +W and +L side-by-side buttons */}
                    <View style={[styles.modalOptionRow, { marginTop: 14 }]}>
                      <TouchableOpacity
                        style={[styles.modalBtnCompact, styles.modalBtnW, { flex: 1 }]}
                        onPress={() => {
                          handleAddEntry(activeMenuDate, 'W');
                          setActiveMenuDate(null);
                        }}
                      >
                        <Text style={styles.modalBtnText}>+ W</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.modalBtnCompact, styles.modalBtnL, { flex: 1 }]}
                        onPress={() => {
                          handleAddEntry(activeMenuDate, 'L');
                          setActiveMenuDate(null);
                        }}
                      >
                        <Text style={styles.modalBtnText}>+ L</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Clear Stack vs Remove Day */}
                    {activeMenuDate && (data[activeMenuDate] || []).length > 0 ? (
                      <TouchableOpacity
                        style={[styles.modalBtnCompact, styles.modalBtnClear, { marginTop: 8 }]}
                        onPress={() => handleClearRow(activeMenuDate)}
                      >
                        <Text style={styles.modalBtnClearText}>Clear Day's Stack</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.modalBtnCompact, styles.modalBtnClear, { marginTop: 8 }]}
                        onPress={() => handleRemoveDay(activeMenuDate)}
                      >
                        <Text style={styles.modalBtnClearText}>🗑️ Remove Day</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[styles.modalBtnCompact, styles.modalBtnCancel, { marginTop: 8 }]}
                      onPress={() => setActiveMenuDate(null)}
                    >
                      <Text style={styles.modalBtnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 32 : 12,
    paddingHorizontal: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 1,
  },
  globalActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 12,
    alignItems: 'center',
  },
  globalActionsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  globalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  globalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  globalBtnW: {
    backgroundColor: '#10B981',
  },
  globalBtnL: {
    backgroundColor: '#EF4444',
  },
  globalBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumberOrange: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F59E0B',
  },
  statNumberBlue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6366F1',
  },
  statRatioText: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
    gap: 10,
  },
  dayRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  rowTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  rowDateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  rowSubDate: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dayCountBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  stackContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
    minHeight: 32,
  },
  emptyStackText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeW: {
    backgroundColor: '#10B981',
  },
  badgeL: {
    backgroundColor: '#EF4444',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  // Hero Display Card (Full Width)
  badgeHeroCard: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
    borderWidth: 1.5,
  },
  badgeHeroCardW: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeHeroCardL: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  badgeTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 6,
  },
  badgeTypePillW: {
    backgroundColor: '#D1FAE5',
  },
  badgeTypePillL: {
    backgroundColor: '#FEE2E2',
  },
  badgeTypePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  badgeHeroBodyText: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  badgeHeroBodyTextW: {
    color: '#065F46',
  },
  badgeHeroBodyTextL: {
    color: '#991B1B',
  },
  noteIndicator: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD700',
  },
  footerActions: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 4,
  },
  footerBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  footerBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  // Modal & Keyboard Avoiding Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardAvoidingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  modalSubTitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 2,
  },
  badgeActionList: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  noteInputContainer: {
    width: '85%',
    gap: 8,
    marginTop: 4,
    alignItems: 'center',
  },
  noteTextInput: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  noteSaveRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  modalOptionRow: {
    flexDirection: 'row',
    gap: 8,
    width: '85%',
    marginBottom: 8,
  },
  modalBtnCompact: {
    width: '85%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnW: {
    backgroundColor: '#10B981',
  },
  modalBtnL: {
    backgroundColor: '#EF4444',
  },
  modalBtnNote: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  modalBtnNoteText: {
    color: '#4338CA',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalBtnClear: {
    backgroundColor: '#FEE2E2',
  },
  modalBtnClearText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  modalBtnCancel: {
    backgroundColor: '#F1F5F9',
  },
  modalBtnCancelText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
});
