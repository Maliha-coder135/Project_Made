				SOURCE CODE:
			Student Management System


WelcomePage CLASS MAIN CLASS



package finalproject;

import javax.swing.*;

public class WelcomePage {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(WelcomePage::createWelcomePage);
    }

    public static void createWelcomePage() {
        JFrame frame = new JFrame("School Management System");
        frame.setSize(500, 300);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setLayout(null);
        frame.setLocationRelativeTo(null);

        JLabel label = new JLabel("Welcome to School Management System");
        label.setBounds(100, 50, 300, 30);
        frame.add(label);

        JButton loginBtn = new JButton("Login");
        loginBtn.setBounds(200, 120, 100, 30);
        loginBtn.addActionListener(e -> LoginPage.showLogin(frame));
        frame.add(loginBtn);

        frame.setVisible(true);
    }
}





LoginPage CLASS


package finalproject;

import javax.swing.*;
import java.sql.*;

public class LoginPage {
    public static void showLogin(JFrame parent) {
        JFrame login = new JFrame("Login");
        login.setSize(300, 200);
        login.setLayout(null);
        login.setLocationRelativeTo(parent);

        JLabel userL = new JLabel("Username:");
        userL.setBounds(30, 30, 80, 25);
        JTextField userF = new JTextField();
        userF.setBounds(120, 30, 130, 25);
        login.add(userL);
        login.add(userF);

        JLabel passL = new JLabel("Password:");
        passL.setBounds(30, 70, 80, 25);
        JPasswordField passF = new JPasswordField();
        passF.setBounds(120, 70, 130, 25);
        login.add(passL);
        login.add(passF);

        JButton submit = new JButton("Submit");
        submit.setBounds(100, 110, 100, 30);
        submit.addActionListener(e -> {
            if (validateLogin(userF.getText(), new String(passF.getPassword()))) {
                login.dispose();
                Dashboard.createDashboard();
            } else {
                JOptionPane.showMessageDialog(login, "Invalid credentials!");
            }
        });
        login.add(submit);
        login.setVisible(true);
    }

    private static boolean validateLogin(String user, String pass) {
        try (Connection conn = DatabaseConnector.getConnection()) {
            PreparedStatement stmt = conn.prepareStatement("SELECT * FROM system_users WHERE username=? AND password=?");
            stmt.setString(1, user);
            stmt.setString(2, pass);
            ResultSet rs = stmt.executeQuery();
            return rs.next();
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }
}












DatabaseConnector CLASS







package finalproject;

import java.sql.*;

public class DatabaseConnector {
    private static final String DB_URL = "jdbc:oracle:thin:@localhost:1521:XE";
    private static final String DB_USER = "STUDENT_DB";
    private static final String DB_PASS = "oracle";

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
    }

    public static boolean recordExists(String table, String column, String value) throws SQLException {
        if (value == null || value.isEmpty()) return false;
        try (Connection conn = getConnection()) {
            String sql = "SELECT 1 FROM " + table + " WHERE " + column + " = ?";
            PreparedStatement stmt = conn.prepareStatement(sql);
            stmt.setString(1, value);
            ResultSet rs = stmt.executeQuery();
            return rs.next();
        }
    }
}











package finalproject;

import javax.swing.*;
import java.awt.*;

public class Dashboard {
    public static void createDashboard() {
        JFrame dash = new JFrame("Admin Dashboard");
        dash.setSize(600, 500);
        dash.setLayout(new GridLayout(0, 2, 10, 10));
        dash.setLocationRelativeTo(null);
        dash.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        JButton[] buttons = {
            new JButton("Add Student"), new JButton("View Students"),
            new JButton("Add Teacher"), new JButton("View Teachers"),
            new JButton("Add Course"), new JButton("View Courses"),
            new JButton("Add Enrollment"), new JButton("View Enrollments"),
            new JButton("Add Assignment"), new JButton("View Assignments"),
            new JButton("Add Grade"), new JButton("View Grades")
        };

        buttons[0].addActionListener(e -> DataForm.showForm("students58", new String[]{"ID","Name","Grade","Email","Phone","Address"}));
        buttons[1].addActionListener(e -> DataViewer.showTable("SELECT * FROM students58", "students58"));
        buttons[2].addActionListener(e -> DataForm.showForm("teachers", new String[]{"ID","Name","Subject","Email","Phone","Department"}));
        buttons[3].addActionListener(e -> DataViewer.showTable("SELECT * FROM teachers", "teachers"));
        buttons[4].addActionListener(e -> DataForm.showForm("courses33", new String[]{"ID","Name","TeacherID","Department","CreditHours","Description"}));
        buttons[5].addActionListener(e -> DataViewer.showTable("SELECT * FROM courses33", "courses33"));
        buttons[6].addActionListener(e -> DataForm.showForm("enrollments", new String[]{"ID","StudentID","CourseID","EnrollmentDate","Status"}));
        buttons[7].addActionListener(e -> DataViewer.showTable("SELECT * FROM enrollments", "enrollments"));
        buttons[8].addActionListener(e -> DataForm.showForm("assignments", new String[]{"ID","CourseID","TeacherID","Title","Description","DueDate","Status"}));
        buttons[9].addActionListener(e -> DataViewer.showTable("SELECT * FROM assignments", "assignments"));
        buttons[10].addActionListener(e -> DataForm.showForm("grades", new String[]{"ID","StudentID","CourseID","AssignmentID","Grade","Date","Feedback"}));
        buttons[11].addActionListener(e -> DataViewer.showTable("SELECT * FROM grades", "grades"));

        for (JButton btn : buttons) dash.add(btn);
        dash.setVisible(true);
    }
}



 DataForm CLASS

package finalproject;

import javax.swing.*;
import java.sql.*;
import java.text.SimpleDateFormat;

public class DataForm {
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd");

    public static void showForm(String table, String[] fields) {
        JFrame frame = new JFrame("Add to " + table);
        frame.setSize(400, 50 + fields.length*50);
        frame.setLayout(null);
        frame.setLocationRelativeTo(null);

        JComponent[] inputs = new JComponent[fields.length];
        for (int i = 0; i < fields.length; i++) {
            JLabel l = new JLabel(fields[i]+":");
            l.setBounds(30, 30 + i*40, 100, 25);
            
            if (fields[i].equalsIgnoreCase("status")) {
                String[] options = {};
                if (table.equals("enrollments")) {
                    options = new String[]{"ACTIVE", "WITHDRAWN", "COMPLETED"};
                } else if (table.equals("assignments")) {
                    options = new String[]{"PENDING", "SUBMITTED", "GRADED"};
                }
                JComboBox<String> combo = new JComboBox<>(options);
                combo.setBounds(140, 30 + i*40, 200, 25);
                frame.add(combo);
                inputs[i] = combo;
            } else if (fields[i].toLowerCase().contains("date")) {
                JTextField dateField = new JTextField();
                dateField.setBounds(140, 30 + i*40, 200, 25);
                frame.add(dateField);
                inputs[i] = dateField;
            } else {
                JTextField textField = new JTextField();
                textField.setBounds(140, 30 + i*40, 200, 25);
                frame.add(textField);
                inputs[i] = textField;
            }
            frame.add(l);
        }

        JButton save = new JButton("Save");
        save.setBounds(140, 30 + fields.length*40, 100, 30);
        save.addActionListener(e -> saveData(table, fields, inputs, frame));
        frame.add(save);
        frame.setVisible(true);
    }

    private static void saveData(String table, String[] fields, JComponent[] inputs, JFrame frame) {
        try (Connection conn = DatabaseConnector.getConnection()) {
            if (table.equals("enrollments")) {
                if (!DatabaseConnector.recordExists("students58", "student_id", getInputValue(inputs[1]))) {
                    JOptionPane.showMessageDialog(frame, "Student ID does not exist!");
                    return;
                }
                if (!DatabaseConnector.recordExists("courses33", "course_id", getInputValue(inputs[2]))) {
                    JOptionPane.showMessageDialog(frame, "Course ID does not exist!");
                    return;
                }
            } else if (table.equals("assignments")) {
                if (!DatabaseConnector.recordExists("courses33", "course_id", getInputValue(inputs[1]))) {
                    JOptionPane.showMessageDialog(frame, "Course ID does not exist!");
                    return;
                }
                if (!DatabaseConnector.recordExists("teachers", "teacher_id", getInputValue(inputs[2]))) {
                    JOptionPane.showMessageDialog(frame, "Teacher ID does not exist!");
                    return;
                }
            } else if (table.equals("grades")) {
                if (!DatabaseConnector.recordExists("students58", "student_id", getInputValue(inputs[1]))) {
                    JOptionPane.showMessageDialog(frame, "Student ID does not exist!");
                    return;
                }
                if (!DatabaseConnector.recordExists("courses33", "course_id", getInputValue(inputs[2]))) {
                    JOptionPane.showMessageDialog(frame, "Course ID does not exist!");
                    return;
                }
                String assignmentId = getInputValue(inputs[3]);
                if (assignmentId != null && !assignmentId.isEmpty() && 
                    !DatabaseConnector.recordExists("assignments", "assignment_id", assignmentId)) {
                    JOptionPane.showMessageDialog(frame, "Assignment ID does not exist!");
                    return;
                }
            }

            String placeholders = String.join(",", java.util.Collections.nCopies(fields.length, "?"));
            String sql = "INSERT INTO "+table+" VALUES("+placeholders+")";
            PreparedStatement stmt = conn.prepareStatement(sql);
            
            for (int i=0; i<fields.length; i++) {
                String value = getInputValue(inputs[i]);
                if (fields[i].toLowerCase().contains("date") && !value.isEmpty()) {
                    stmt.setDate(i+1, new java.sql.Date(DATE_FORMAT.parse(value).getTime()));
                } else {
                    stmt.setString(i+1, value);
                }
            }
            
            stmt.executeUpdate();
            JOptionPane.showMessageDialog(frame, "Record added to " + table + " successfully!");
            frame.dispose();
        } catch(SQLException ex) { 
            ex.printStackTrace(); 
            JOptionPane.showMessageDialog(frame, "Database error: " + ex.getMessage());
        } catch (Exception ex) {
            ex.printStackTrace();
            JOptionPane.showMessageDialog(frame, "Error: " + ex.getMessage());
        }
    }

    public static String getInputValue(JComponent component) {
        if (component instanceof JTextField) {
            return ((JTextField) component).getText();
        } else if (component instanceof JComboBox) {
            return (String) ((JComboBox<?>) component).getSelectedItem();
        }
        return "";
    }
}




 DataViewer CLASS




package finalproject;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.sql.*;

public class DataViewer {
    public static void showTable(String query, String tableName) {
        JFrame frame = new JFrame("View Data: " + tableName);
        frame.setSize(800, 500);
        frame.setLayout(new BorderLayout());

        DefaultTableModel model = new DefaultTableModel() {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false; // Make table cells non-editable
            }
        };
        JTable table = new JTable(model);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        // Button panel
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.CENTER, 10, 10));
        JButton backButton = new JButton("Back");
        JButton deleteButton = new JButton("Delete");
        JButton updateButton = new JButton("Update");
        buttonPanel.add(backButton);
        buttonPanel.add(deleteButton);
        buttonPanel.add(updateButton);

        try (Connection conn = DatabaseConnector.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {

            ResultSetMetaData meta = rs.getMetaData();
            int col = meta.getColumnCount();
            for (int i = 1; i <= col; i++) {
                model.addColumn(meta.getColumnName(i));
            }

            while (rs.next()) {
                Object[] row = new Object[col];
                for (int i = 0; i < col; i++) {
                    row[i] = rs.getObject(i + 1);
                }
                model.addRow(row);
            }
        } catch (SQLException ex) {
            ex.printStackTrace();
            JOptionPane.showMessageDialog(frame, "Database error: " + ex.getMessage());
        }

        // Add action listeners
        backButton.addActionListener(e -> {
            frame.dispose();
            Dashboard.createDashboard();
        });

        deleteButton.addActionListener(e -> deleteRecord(frame, table, model, tableName));
        updateButton.addActionListener(e -> updateRecord(frame, table, model, tableName));

        frame.add(new JScrollPane(table), BorderLayout.CENTER);
        frame.add(buttonPanel, BorderLayout.SOUTH);
        frame.setVisible(true);
    }

    private static void deleteRecord(JFrame frame, JTable table, DefaultTableModel model, String tableName) {
        int selectedRow = table.getSelectedRow();
        if (selectedRow == -1) {
            JOptionPane.showMessageDialog(frame, "Please select a row to delete");
            return;
        }

        int confirm = JOptionPane.showConfirmDialog(frame, 
            "Are you sure you want to delete this record?", "Confirm Delete", 
            JOptionPane.YES_NO_OPTION);
        
        if (confirm == JOptionPane.YES_OPTION) {
            try (Connection conn = DatabaseConnector.getConnection()) {
                String idColumn = model.getColumnName(0); // Assuming first column is ID
                Object idValue = model.getValueAt(selectedRow, 0);
                
                String sql = "DELETE FROM " + tableName + " WHERE " + idColumn + " = ?";
                PreparedStatement pstmt = conn.prepareStatement(sql);
                
                if (idValue instanceof Integer) {
                    pstmt.setInt(1, (Integer) idValue);
                } else if (idValue instanceof String) {
                    pstmt.setString(1, (String) idValue);
                } else {
                    pstmt.setObject(1, idValue);
                }
                
                int rowsAffected = pstmt.executeUpdate();
                if (rowsAffected > 0) {
                    model.removeRow(selectedRow);
                    JOptionPane.showMessageDialog(frame, "Record deleted successfully");
                }
            } catch (SQLException ex) {
                ex.printStackTrace();
                JOptionPane.showMessageDialog(frame, "Error deleting record: " + ex.getMessage());
            }
        }
    }

    private static void updateRecord(JFrame parent, JTable table, DefaultTableModel model, String tableName) {
        int selectedRow = table.getSelectedRow();
        if (selectedRow == -1) {
            JOptionPane.showMessageDialog(parent, "Please select a row to update");
            return;
        }

        // Get column names and current values
        int colCount = model.getColumnCount();
        String[] fields = new String[colCount];
        String[] currentValues = new String[colCount];
        
        for (int i = 0; i < colCount; i++) {
            fields[i] = model.getColumnName(i);
            Object value = model.getValueAt(selectedRow, i);
            currentValues[i] = (value != null) ? value.toString() : "";
        }

        // Show update form
        JFrame updateFrame = new JFrame("Update Record");
        updateFrame.setSize(400, 50 + fields.length * 50);
        updateFrame.setLayout(null);
        updateFrame.setLocationRelativeTo(parent);

        JComponent[] inputs = new JComponent[fields.length];
        for (int i = 0; i < fields.length; i++) {
            JLabel l = new JLabel(fields[i] + ":");
            l.setBounds(30, 30 + i * 40, 100, 25);

            if (fields[i].equalsIgnoreCase("status")) {
                String[] options = {};
                if (tableName.equals("enrollments")) {
                    options = new String[]{"ACTIVE", "WITHDRAWN", "COMPLETED"};
                } else if (tableName.equals("assignments")) {
                    options = new String[]{"PENDING", "SUBMITTED", "GRADED"};
                }
                JComboBox<String> combo = new JComboBox<>(options);
                combo.setSelectedItem(currentValues[i]);
                combo.setBounds(140, 30 + i * 40, 200, 25);
                updateFrame.add(combo);
                inputs[i] = combo;
            } else {
                JTextField textField = new JTextField(currentValues[i]);
                textField.setBounds(140, 30 + i * 40, 200, 25);
                updateFrame.add(textField);
                inputs[i] = textField;
            }
            updateFrame.add(l);
        }

        JButton saveButton = new JButton("Save Changes");
        saveButton.setBounds(140, 30 + fields.length * 40, 150, 30);
        saveButton.addActionListener(e -> {
            try (Connection conn = DatabaseConnector.getConnection()) {
                // Build the update query
                StringBuilder sql = new StringBuilder("UPDATE " + tableName + " SET ");
                for (int i = 1; i < fields.length; i++) { // Skip ID field (assuming it's first)
                    sql.append(fields[i]).append(" = ?, ");
                }
                sql.delete(sql.length() - 2, sql.length()); // Remove last comma
                sql.append(" WHERE ").append(fields[0]).append(" = ?");

                PreparedStatement pstmt = conn.prepareStatement(sql.toString());
                
                // Set values for each field (skip ID for now)
                for (int i = 1; i < fields.length; i++) {
                    String value = DataForm.getInputValue(inputs[i]);
                    pstmt.setString(i, value);
                }
                
                // Set ID value for WHERE clause
                Object idValue = model.getValueAt(selectedRow, 0);
                if (idValue instanceof Integer) {
                    pstmt.setInt(fields.length, (Integer) idValue);
                } else if (idValue instanceof String) {
                    pstmt.setString(fields.length, (String) idValue);
                } else {
                    pstmt.setObject(fields.length, idValue);
                }

                int rowsAffected = pstmt.executeUpdate();
                if (rowsAffected > 0) {
                    // Update the table model
                    for (int i = 0; i < fields.length; i++) {
                        model.setValueAt(DataForm.getInputValue(inputs[i]), selectedRow, i);
                    }
                    JOptionPane.showMessageDialog(updateFrame, "Record updated successfully");
                    updateFrame.dispose();
                }
            } catch (SQLException ex) {
                ex.printStackTrace();
                JOptionPane.showMessageDialog(updateFrame, "Error updating record: " + ex.getMessage());
            }
        });

        updateFrame.add(saveButton);
        updateFrame.setVisible(true);
    }
}




