// В релизной сборке под Windows не открывать консольное окно.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    anilibrix_lib::run()
}
