import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

const sections = [
  {
    title: '§ 1 Postanowienia ogólne i Usługodawca',
    paragraphs: [
      'Niniejszy Regulamin określa zasady korzystania z aplikacji mobilnej oraz serwisu internetowego pod nazwą „Zleć Majstra”, zwanych dalej „Aplikacją”.',
      'Usługodawcą i właścicielem Aplikacji jest MM Renowacje Monika Marcinkowska, ul. Kawiary 25/19, 62-200 Gniezno, NIP: 7842236876, e-mail: aplikacjegniezno@int.pl, zwana dalej „Usługodawcą”.',
      'Każda osoba instalująca Aplikację lub zakładająca konto akceptuje niniejszy Regulamin.',
    ],
  },
  {
    title: '§ 2 Definicje',
    paragraphs: [
      'Aplikacja – oprogramowanie „Zleć Majstra” wraz z całym kodem źródłowym, kodem obiektowym, interfejsem użytkownika (UI/UX), grafiką, logo, bazą danych, algorytmami, modelem biznesowym, dokumentacją i elementami audiowizualnymi.',
      'Użytkownik – każda osoba fizyczna, prawna lub jednostka korzystająca z Aplikacji.',
      'Treści – wszelkie treści zamieszczone w Aplikacji.',
    ],
  },
  {
    title: '§ 3 Zasady korzystania i Licencja',
    paragraphs: [
      'Usługodawca udziela Użytkownikowi niewyłącznej, nieprzenoszalnej, terytorialnie nieograniczonej licencji na korzystanie z Aplikacji wyłącznie w celu jej osobistego użytku zgodnie z przeznaczeniem.',
      'Licencja nie obejmuje prawa do udzielania sublicencji, odsprzedaży, wynajmu ani udostępniania Aplikacji osobom trzecim.',
      'Użytkownik nie nabywa żadnych praw własności intelektualnej do Aplikacji. Wszelkie prawa pozostają przy Usługodawcy.',
    ],
  },
  {
    title: '§ 4 Własność Intelektualna',
    paragraphs: [
      'Aplikacja „Zleć Majstra” jako całość oraz jej pojedyncze elementy stanowią utwór w rozumieniu ustawy z dnia 4 lutego 1994 r. o prawie autorskim i prawach pokrewnych oraz przedmiot praw własności intelektualnej Usługodawcy.',
      'Ochronie podlegają w szczególności: kod źródłowy i obiektowy Aplikacji; szata graficzna, layout, układ funkcjonalny, interfejs użytkownika UI/UX, ikony i logo „Zleć Majstra”; baza danych zleceń, wykonawców i zleceniodawców; algorytmy dopasowywania, logika działania, model biznesowy oraz know-how i tajemnica przedsiębiorstwa Usługodawcy.',
      'Nazwa „Zleć Majstra”, logo oraz szata graficzna stanowią znak towarowy i podlegają ochronie prawnej. Trwa procedura zgłoszenia znaku w EUIPO / UPRP.',
      'Wszelkie kopiowanie, powielanie, modyfikowanie całości lub części Aplikacji bez pisemnej zgody Usługodawcy jest zabronione.',
    ],
  },
  {
    title: '§ 5 Bezwzględny zakaz kopiowania i klonowania',
    paragraphs: [
      'W celu ochrony praw Usługodawcy, Użytkownikowi oraz jakiejkolwiek osobie trzeciej, która uzyskała dostęp do Aplikacji, ZABRANIA SIĘ pod rygorem odpowiedzialności odszkodowawczej i karnej:',
      '1. Zakaz reverse engineering: dekompilacji, dezasemblacji, deobfuskacji, analizy kodu, obchodzenia zabezpieczeń technicznych.',
      '2. Zakaz scrapingu i kopiowania: automatycznego lub manualnego pobierania, kopiowania, reprodukowania treści, bazy danych, list wykonawców, opisów, zdjęć za pomocą botów, scraperów, crawlerów.',
      '3. Zakaz tworzenia dzieł zależnych i klonów: tworzenia na bazie Aplikacji, jej wyglądu, funkcjonalności lub jej części jakichkolwiek innych aplikacji, serwisów, oprogramowania o podobnym przeznaczeniu, w szczególności o charakterze konkurencyjnym. Za naruszenie uznaje się również stworzenie produktu o istotnie podobnym układzie funkcjonalnym, przepływie użytkownika (user flow) lub logice biznesowej, który powstał w wyniku inspiracji Aplikacją.',
      '4. Zakaz wykorzystywania know-how: wykorzystywania informacji o sposobie działania, funkcjach i pomysłach zawartych w Aplikacji do budowy własnego produktu konkurencyjnego.',
      'Naruszenie § 5 ust. 3 i 4 będzie traktowane jako naruszenie tajemnicy przedsiębiorstwa w rozumieniu ustawy o zwalczaniu nieuczciwej konkurencji (Dz.U. 2022 poz. 1233) oraz jako czyn nieuczciwej konkurencji z art. 3 i art. 11 tej ustawy.',
    ],
  },
  {
    title: '§ 6 Konsekwencje naruszenia',
    paragraphs: [
      'W przypadku stwierdzenia naruszenia § 4 i § 5, Usługodawca uprawniony jest do: natychmiastowego zablokowania konta Użytkownika; zgłoszenia naruszenia do Google LLC, Apple Inc. w celu usunięcia aplikacji-klona ze sklepów Google Play i App Store w trybie DMCA; zgłoszenia naruszenia do Google Search w celu usunięcia strony-klona z wyników wyszukiwania; wystąpienia na drogę sądową z roszczeniem o zaniechanie naruszeń, usunięcie skutków naruszenia, wydanie bezpodstawnie uzyskanych korzyści oraz zapłatę odszkodowania na zasadach ogólnych lub poprzez zapłatę trzykrotności stosownego wynagrodzenia (art. 79 Prawa Autorskiego).',
      'Usługodawca zastrzega sobie prawo do dochodzenia odszkodowania w wysokości rzeczywiście poniesionej szkody, w tym utraconych korzyści, w pełnej wysokości.',
      'Użytkownik ponosi pełną odpowiedzialność za działania osób trzecich, którym udostępnił dostęp do swojego konta.',
    ],
  },
  {
    title: '§ 7 Oświadczenie o autorstwie i dowody',
    paragraphs: [
      'Usługodawca posiada pełną dokumentację powstania Aplikacji: repozytoria kodu z historią commitów, projekty graficzne, umowy przenoszące autorskie prawa majątkowe od wykonawców, depozyty notarialne kodu źródłowego.',
      'W kodzie Aplikacji umieszczono cyfrowe znaki wodne oraz identyfikatory umożliwiające jednoznaczne udowodnienie autorstwa w postępowaniu sądowym.',
    ],
  },
  {
    title: '§ 8 Postanowienia końcowe',
    paragraphs: [
      'Regulamin dostępny jest nieodpłatnie w Aplikacji.',
      'W sprawach nieuregulowanych stosuje się prawo polskie.',
      'Sądem właściwym do rozstrzygania sporów jest sąd właściwy dla siedziby Usługodawcy, tj. sąd w Gnieźnie / Poznaniu.',
      'Kontakt w sprawach naruszeń: aplikacjegniezno@int.pl.',
    ],
  },
];

export default function TermsScreen() {
  const colors = useColors();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>ZLEĆ MAJSTRA</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Regulamin aplikacji mobilnej i serwisu „Zleć Majstra”</Text>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>Obowiązuje od: 01.09.2026</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={[styles.paragraph, { color: colors.mutedForeground }]}>{paragraph}</Text>
            ))}
          </View>
        ))}
        <Text style={[styles.notice, { color: colors.mutedForeground }]}>
          Akceptując Regulamin w Aplikacji, Użytkownik oświadcza, że zapoznał się z zakazem klonowania i kopiowania określonym w § 5 i zobowiązuje się go przestrzegać.
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.backButtonText, { color: colors.background }]}>Wróć</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 22, paddingBottom: 48 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 30, lineHeight: 36 },
  date: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 16 },
  divider: { height: 1, marginVertical: 28 },
  section: { marginBottom: 27 },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, lineHeight: 26, marginBottom: 8 },
  paragraph: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22, marginBottom: 9 },
  notice: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 20, marginTop: 2 },
  backButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  backButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
});