import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@photo_journal/entries";

export default function App() {
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pickedUri, setPickedUri] = useState(null);
  const [noteText, setNoteText] = useState("");

  const [viewerEntry, setViewerEntry] = useState(null);
  const [priming, setPriming] = useState({ visible: false, type: null });

  // ---- Startup: muat entri tersimpan -----------------------------------
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setEntries(JSON.parse(raw));
      } catch (e) {
        console.warn("Gagal memuat jurnal:", e);
      } finally {
        setLoadingEntries(false);
      }
    })();
  }, []);

  const persistEntries = async (newEntries) => {
    setEntries(newEntries);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    } catch (e) {
      console.warn("Gagal menyimpan jurnal:", e);
      Alert.alert("Gagal Menyimpan", "Entri jurnal tidak berhasil disimpan.");
    }
  };

  // ---- Alur pilih sumber foto -------------------------------------------
  const openAddFlow = () => {
    Alert.alert("Tambah Foto", "Pilih sumber foto untuk entri jurnalmu", [
      { text: "📷 Kamera", onPress: () => beginPick("camera") },
      { text: "🖼️ Galeri", onPress: () => beginPick("gallery") },
      { text: "Batal", style: "cancel" },
    ]);
  };

  const beginPick = async (type) => {
    const current =
      type === "camera"
        ? await ImagePicker.getCameraPermissionsAsync()
        : await ImagePicker.getMediaLibraryPermissionsAsync();

    if (current.status === "granted") {
      launchPicker(type);
    } else if (current.status === "denied" && !current.canAskAgain) {
      showDeniedAlert(type);
    } else {
      setPriming({ visible: true, type });
    }
  };

  const confirmPriming = async () => {
    const type = priming.type;
    setPriming({ visible: false, type: null });

    const result =
      type === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (result.status === "granted") {
      launchPicker(type);
    } else {
      showDeniedAlert(type);
    }
  };

  const showDeniedAlert = (type) => {
    const label = type === "camera" ? "kamera" : "galeri";
    Alert.alert(
      "Izin Ditolak",
      `Kami tidak bisa mengakses ${label} tanpa izin. Aktifkan lewat Pengaturan HP untuk mencoba lagi.`,
      [
        { text: "Nanti Saja", style: "cancel" },
        { text: "Buka Pengaturan", onPress: () => Linking.openSettings() },
      ]
    );
  };

  const launchPicker = async (type) => {
    try {
      const options = {
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      };
      const result =
        type === "camera"
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const uri = result.assets[0].uri;
      setPickedUri(uri);
      setNoteText("");
      setAddModalVisible(true);
    } catch (e) {
      console.warn(e);
      Alert.alert("Gagal", "Terjadi masalah saat mengambil foto.");
    }
  };

  const handleSaveEntry = () => {
    if (!pickedUri) return;
    const entry = {
      id: Date.now().toString(),
      uri: pickedUri,
      note: noteText.trim(),
      date: new Date().toLocaleString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    persistEntries([entry, ...entries]);
    closeAddModal();
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
    setPickedUri(null);
    setNoteText("");
  };

  const handleDeleteEntry = (id) => {
    Alert.alert("Hapus Entri", "Yakin ingin menghapus catatan jurnal ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          persistEntries(entries.filter((e) => e.id !== id));
          setViewerEntry(null);
        },
      },
    ]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setViewerEntry(item)} activeOpacity={0.8}>
      <Image source={{ uri: item.uri }} style={styles.thumb} />
      <View style={styles.cardBody}>
        <Text style={styles.cardDate}>{item.date}</Text>
        <Text style={styles.cardNote} numberOfLines={2}>
          {item.note || <Text style={{ fontStyle: "italic", color: "#999" }}>Tanpa catatan teks</Text>}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.trashBtn}
        onPress={() => handleDeleteEntry(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={{ fontSize: 18 }}>🗑️</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📔 Photo Journal</Text>
        <Text style={styles.headerSubtitle}>{entries.length} catatan tersimpan</Text>
      </View>

      {loadingEntries ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2E5C8A" />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🖼️</Text>
          <Text style={styles.emptyText}>
            Belum ada catatan. Tap tombol + di bawah untuk mulai menulis jurnal fotomu!
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={openAddFlow}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ---- Priming Modal ------------------- */}
      <Modal visible={priming.visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.primingBox}>
            <Text style={styles.bigIcon}>{priming.type === "camera" ? "📷" : "🖼️"}</Text>
            <Text style={styles.primingTitle}>
              Izin {priming.type === "camera" ? "Kamera" : "Galeri"} Dibutuhkan
            </Text>
            <Text style={styles.primingText}>
              {priming.type === "camera"
                ? "Photo Journal butuh akses kamera untuk mengambil foto langsung sebagai bagian dari catatan harianmu."
                : "Photo Journal butuh akses galeri untuk memilih foto yang sudah ada sebagai bagian dari catatan harianmu."}{" "}
              Foto hanya disimpan di HP-mu sendiri, tidak diunggah ke server manapun.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={confirmPriming}>
              <Text style={styles.primaryButtonText}>Lanjutkan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.textButton}
              onPress={() => setPriming({ visible: false, type: null })}
            >
              <Text style={styles.textButtonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---- Modal Tambah Entri --------------------------------------------- */}
      <Modal visible={addModalVisible} animationType="slide">
        <SafeAreaView style={styles.safe}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <View style={[styles.modalHeader, styles.modalHeaderAndroidPadding]}>
              <TouchableOpacity onPress={closeAddModal}>
                <Text style={styles.modalHeaderAction}>Batal</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Entri Baru</Text>
              <TouchableOpacity onPress={handleSaveEntry} disabled={!pickedUri}>
                <Text
                  style={[
                    styles.modalHeaderAction,
                    { color: pickedUri ? "#2E5C8A" : "#BBB", fontWeight: "700" },
                  ]}
                >
                  Simpan
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {pickedUri && <Image source={{ uri: pickedUri }} style={styles.previewImage} />}
              <TouchableOpacity style={styles.secondaryButton} onPress={openAddFlow}>
                <Text style={styles.secondaryButtonText}>Ganti Foto</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.noteInput}
                placeholder="Tulis ceritamu hari ini..."
                placeholderTextColor="#999"
                multiline
                value={noteText}
                onChangeText={setNoteText}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ---- Modal Viewer Entri -------------------------------------------- */}
      <Modal visible={!!viewerEntry} animationType="slide">
        <SafeAreaView style={styles.safe}>
          <View style={[styles.modalHeader, styles.modalHeaderAndroidPadding]}>
            <TouchableOpacity onPress={() => setViewerEntry(null)}>
              <Text style={styles.modalHeaderAction}>Tutup</Text>
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Detail Catatan</Text>
            <TouchableOpacity onPress={() => viewerEntry && handleDeleteEntry(viewerEntry.id)}>
              <Text style={[styles.modalHeaderAction, { color: "#C0392B" }]}>Hapus</Text>
            </TouchableOpacity>
          </View>
          {viewerEntry && (
            <View style={styles.modalBody}>
              <Image source={{ uri: viewerEntry.uri }} style={styles.previewImage} />
              <Text style={styles.viewerDate}>{viewerEntry.date}</Text>
              <Text style={styles.viewerNote}>
                {viewerEntry.note || "Tanpa catatan teks untuk entri ini."}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F9FB" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 },

  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 12 : 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF0",
    backgroundColor: "#FFFFFF",
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#2E5C8A" },
  headerSubtitle: { fontSize: 13, color: "#888", marginTop: 2 },

  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#666", textAlign: "center", lineHeight: 22 },

  listContent: { padding: 16, paddingBottom: 100 },
  card: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: "#EEE" },
  cardBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardDate: { fontSize: 12, color: "#999", marginBottom: 4 },
  cardNote: { fontSize: 14, color: "#333" },
  trashBtn: { padding: 6 },

  fab: {
    position: "absolute",
    right: 24,
    bottom: 32,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#2E5C8A",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: { color: "#FFFFFF", fontSize: 30, fontWeight: "300", marginTop: -2 },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  primingBox: {
    width: "84%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  bigIcon: { fontSize: 44, marginBottom: 10 },
  primingTitle: { fontSize: 18, fontWeight: "700", color: "#222", marginBottom: 8, textAlign: "center" },
  primingText: { fontSize: 14, color: "#555", textAlign: "center", lineHeight: 20, marginBottom: 18 },

  primaryButton: {
    backgroundColor: "#2E5C8A",
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 200,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#2E5C8A",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 18,
  },
  secondaryButtonText: { color: "#2E5C8A", fontSize: 14, fontWeight: "600" },

  textButton: { marginTop: 12, padding: 6 },
  textButtonText: { color: "#888", fontSize: 14 },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5EAF0",
    backgroundColor: "#FFFFFF",
  },
  modalHeaderAndroidPadding: {
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 14 : 14,
  },
  modalHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#222" },
  modalHeaderAction: { fontSize: 15, color: "#555" },

  modalBody: { flex: 1, padding: 20, alignItems: "center" },
  previewImage: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    backgroundColor: "#EEE",
  },
  noteInput: {
    width: "100%",
    minHeight: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E5EB",
    padding: 14,
    fontSize: 15,
    color: "#222",
    textAlignVertical: "top",
    marginTop: 4,
  },
  viewerDate: { fontSize: 13, color: "#999", marginTop: 16, alignSelf: "flex-start" },
  viewerNote: { fontSize: 16, color: "#333", marginTop: 8, lineHeight: 23, alignSelf: "flex-start" },
});