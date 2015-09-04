package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/spf13/cobra"
	"github.com/tag1consulting/pipeviz/interpret"
)

type menuLevel interface {
	Info() ([]byte, error)
	Prompt() ([]byte, error)
	Accept(string) error
	Next(*cliRunner) *cliRunner
}

// cliRunner coordinates control over and interaction with a level
// of interaction in the UI
type cliRunner struct {
	parent *cliRunner
	obj    menuLevel
	w      io.Writer
}

func main() {
	root := &cobra.Command{Use: "pvc"}
	root.AddCommand(envCommand())

	var target string
	root.PersistentFlags().StringVarP(&target, "target", "t", "http://localhost:2309", "Address of the target pipeviz daemon.")

	root.Execute()
}

// wrapForJSON converts data into a map that will serialize
// appropriate pipeviz message JSON.
func wrapForJSON(v interface{}) map[string]interface{} {
	m := make(map[string]interface{})

	switch obj := v.(type) {
	case interpret.Environment:
		m["environments"] = []interpret.Environment{obj}
	case interpret.LogicState:
		m["logic-states"] = []interpret.LogicState{obj}
	}

	return m
}

func toJSONBytes(e interpret.Environment) ([]byte, error) {
	// Convert the data to a map that will write out the correct JSON
	m := wrapForJSON(e)

	msg, err := json.Marshal(m)
	if err != nil {
		return nil, errors.New(fmt.Sprintf("\nError while marshaling data to JSON for validation: %s\n", err.Error()))
	}

	return msg, nil
}

func runCreate(cmd *cobra.Command, args []string) {
	// Create the root runner
	//cr := &cliRunner{
	//w: os.Stdout,
	//}
}

type mainMenu struct {
}

func (m *mainMenu) Info() ([]byte, error) {
	var b bytes.Buffer
	b.WriteString("Which type of state would you like to describe to pipeviz: ")

	return b.Bytes(), nil
}
